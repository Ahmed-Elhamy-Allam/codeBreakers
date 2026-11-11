/**
 * gameStore — strongly-typed Pinia store that owns the entire game loop:
 * lobby/team management, round progression, shared-pool math, scoring,
 * boosters, hints, and Ably event wiring.
 *
 * Authority model: the HOST is the source of truth for shared state
 * (pool, phase, round). Clients apply host-broadcast `stateSync` events.
 * Secret codes live only in KV; this store never sees them.
 */
import { defineStore } from 'pinia';
import {
  DEFAULT_ROOM_CONFIG,
  TEAM_META,
  TEAM_ORDER,
  emptyStats,
  type BoosterType,
  type ChatMessage,
  type GameEvent,
  type GameNotification,
  type GamePhase,
  type GameState,
  type GuessResult,
  type LeaderboardPlayerRow,
  type LeaderboardRow,
  type Player,
  type PlayerBoard,
  type RoomConfig,
  type Team,
  type TeamId,
} from '@/types/game';
import { ablyService } from '@/services/ably';
import { chatService, randomAlias } from '@/services/chat';
import { api } from '@/services/api';
import { sound } from '@/services/SoundService';
import { identifyPlayer, setTag, trackEvent } from '@/services/analytics';

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function emptyBoard(playerId: string, codeLength: number): PlayerBoard {
  return {
    playerId,
    status: 'cracking',
    codeLength,
    history: [],
    lockedPositions: [],
    attemptsUsed: 0,
    roundScore: 0,
    hintsUsed: [],
    solvedAt: null,
  };
}

interface GameStoreState {
  localPlayerId: string;
  roomCode: string;
  phase: GamePhase;
  config: RoomConfig;
  round: number;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  boards: Record<string, PlayerBoard>;
  /** Per-team pool (seconds or tries). Banked value at last round start. */
  teamPools: Record<string, number>;
  roundStartedAt: number | null;
  finishOrder: string[];
  leaderboard: LeaderboardRow[];
  connecting: boolean;
  error: string | null;
  // UI state
  showBoosterModal: boolean;
  elapsedTick: number; // forces reactive timer recompute
  // Notifications & chat
  notifications: GameNotification[];
  chat: ChatMessage[];
  unreadChat: number;
  /** Stable chat identity (persists before a room is joined). */
  chatId: string;
  chatAlias: string;
  chatReady: boolean;
  /** Transient floating pool-delta labels keyed by teamId. */
  poolFlash: Record<string, { id: string; delta: number; ts: number } | undefined>;
}

export const useGameStore = defineStore('game', {
  state: (): GameStoreState => ({
    localPlayerId: '',
    roomCode: '',
    phase: 'lobby',
    config: { ...DEFAULT_ROOM_CONFIG },
    round: 1,
    players: {},
    teams: {},
    boards: {},
    teamPools: {},
    roundStartedAt: null,
    finishOrder: [],
    leaderboard: [],
    connecting: false,
    error: null,
    showBoosterModal: false,
    elapsedTick: 0,
    notifications: [],
    chat: [],
    unreadChat: 0,
    chatId: '',
    chatAlias: '',
    chatReady: false,
    poolFlash: {},
  }),

  getters: {
    localPlayer(state): Player | undefined {
      return state.players[state.localPlayerId];
    },
    isHost(state): boolean {
      return state.players[state.localPlayerId]?.isHost ?? false;
    },
    localBoard(state): PlayerBoard | undefined {
      return state.boards[state.localPlayerId];
    },
    canChooseBooster(state): boolean {
      return state.showBoosterModal && state.phase === 'playing' &&
        state.boards[state.localPlayerId]?.status === 'solved' &&
        Object.values(state.boards).some((board) => board.status === 'cracking');
    },
    playerList(state): Player[] {
      return Object.values(state.players);
    },
    activeTeams(state): Team[] {
      return TEAM_ORDER.slice(0, state.config.teamCount).map(
        (id) => state.teams[id] ?? { id, name: TEAM_META[id].name, memberIds: [], score: 0 },
      );
    },
    playersByTeam(state) {
      return (teamId: TeamId): Player[] =>
        Object.values(state.players).filter((p) => p.teamId === teamId);
    },
    localTeamId(state): TeamId | undefined {
      return state.players[state.localPlayerId]?.teamId;
    },
    /** Live remaining pool for a specific team (seconds or tries). */
    teamRemaining(state) {
      return (teamId: TeamId): number => {
        void state.elapsedTick; // dependency so it re-runs each tick
        const banked = state.teamPools[teamId] ?? 0;
        if (state.config.mode === 'tries') return banked;
        if (state.phase !== 'playing' || state.roundStartedAt == null) return banked;
        const elapsed = Math.floor((Date.now() - state.roundStartedAt) / 1000);
        return Math.max(0, banked - elapsed);
      };
    },
    /** Live remaining pool for the local player's team. */
    remaining(): number {
      const tid = this.localTeamId;
      return tid ? this.teamRemaining(tid) : 0;
    },
    sortedTeamsByScore(state): Team[] {
      return Object.values(state.teams).sort((a, b) => b.score - a.score);
    },
  },

  actions: {
    // ---------- Connection / room lifecycle ----------

    async hostRoom(playerName: string, config: RoomConfig): Promise<string> {
      this.connecting = true;
      this.error = null;
      try {
        const roomCode = genRoomCode();
        this.localPlayerId = genId();
        this.roomCode = roomCode;
        this.config = { ...config };

        this.initTeams(config.teamCount);
        const player: Player = {
          id: this.localPlayerId,
          name: playerName,
          teamId: 'alpha',
          isHost: true,
          connected: true,
          totalScore: 0,
          stats: emptyStats(),
        };
        this.players = { [player.id]: player };
        this.teams.alpha.memberIds = [player.id];

        identifyPlayer(player.id, player.name);
        setTag('role', 'host');
        setTag('roomCode', roomCode);
        trackEvent('room_hosted');

        await this.connectAbly(roomCode);
        return roomCode;
      } catch (err) {
        this.error = (err as Error).message;
        throw err;
      } finally {
        this.connecting = false;
      }
    },

    async joinRoom(playerName: string, roomCode: string): Promise<void> {
      this.connecting = true;
      this.error = null;
      try {
        this.localPlayerId = genId();
        this.roomCode = roomCode.toUpperCase();

        // Joiners start unseated on 'alpha'; they pick their real team in the
        // lobby once they can see how many teams the host actually created.
        const player: Player = {
          id: this.localPlayerId,
          name: playerName,
          teamId: 'alpha',
          isHost: false,
          connected: true,
          totalScore: 0,
          stats: emptyStats(),
        };
        this.players = { [player.id]: player };

        identifyPlayer(player.id, player.name);
        setTag('role', 'player');
        setTag('roomCode', this.roomCode);
        trackEvent('room_joined');

        await this.connectAbly(this.roomCode);
        await ablyService.enterPresence(player);
        // Announce ourselves; host replies with full state sync.
        await this.broadcast({
          type: 'playerJoined',
          payload: { player },
          senderId: this.localPlayerId,
          ts: Date.now(),
        });
      } catch (err) {
        this.error = (err as Error).message;
        throw err;
      } finally {
        this.connecting = false;
      }
    },

    async connectAbly(roomCode: string): Promise<void> {
      await ablyService.connect(this.localPlayerId, roomCode);
      ablyService.onEvent((e) => this.handleEvent(e));
      ablyService.onPresence((action, member) => {
        const p = member.data as Player;
        if (!p?.id) return;
        if (action === 'leave') {
          if (this.players[p.id]) this.players[p.id].connected = false;
        } else if (this.players[p.id]) {
          this.players[p.id].connected = true;
        }
      });
      if (this.isHost) {
        await ablyService.enterPresence(this.players[this.localPlayerId]);
      }
    },

    initTeams(count: number): void {
      const teams: Record<string, Team> = {};
      TEAM_ORDER.slice(0, count).forEach((id) => {
        teams[id] = { id, name: TEAM_META[id].name, memberIds: [], score: 0 };
      });
      this.teams = teams;
    },

    broadcast(event: GameEvent): Promise<void> {
      return ablyService.publish(event);
    },

    // ---------- Lobby ----------

    async updateConfig(config: RoomConfig): Promise<void> {
      if (!this.isHost) return;
      this.config = { ...config };
      this.initTeams(config.teamCount);
      // Re-seat players who are on now-removed teams.
      for (const p of Object.values(this.players)) {
        if (!this.teams[p.teamId]) p.teamId = 'alpha';
        if (!this.teams[p.teamId].memberIds.includes(p.id)) {
          this.teams[p.teamId].memberIds.push(p.id);
        }
      }
      await this.syncState();
    },

    async assignTeam(playerId: string, teamId: TeamId): Promise<void> {
      const player = this.players[playerId];
      if (!player || !this.teams[teamId]) return;
      // Remove from old team.
      for (const t of Object.values(this.teams)) {
        t.memberIds = t.memberIds.filter((id) => id !== playerId);
      }
      player.teamId = teamId;
      this.teams[teamId].memberIds.push(playerId);
      sound.play('click');

      if (this.isHost) {
        await this.syncState();
      } else {
        await this.broadcast({
          type: 'teamChanged',
          payload: { playerId, teamId },
          senderId: this.localPlayerId,
          ts: Date.now(),
        });
      }
    },

    /** Host pushes authoritative full state to everyone. */
    syncState(): Promise<void> {
      if (!this.isHost) return Promise.resolve();
      return this.broadcast({
        type: 'stateSync',
        payload: { state: this.snapshot() },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
    },

    snapshot(): GameState {
      return {
        roomCode: this.roomCode,
        phase: this.phase,
        config: this.config,
        round: this.round,
        players: this.players,
        teams: this.teams,
        boards: this.boards,
        teamPools: this.teamPools,
        roundStartedAt: this.roundStartedAt,
        finishOrder: this.finishOrder,
      };
    },

    applySnapshot(s: GameState): void {
      this.roomCode = s.roomCode;
      this.phase = s.phase;
      this.config = s.config;
      this.round = s.round;
      this.players = s.players;
      this.teams = s.teams;
      this.boards = s.boards;
      this.teamPools = s.teamPools;
      this.roundStartedAt = s.roundStartedAt;
      this.finishOrder = s.finishOrder;
    },

    // ---------- Game start & rounds ----------

    async startGame(): Promise<void> {
      if (!this.isHost) return;
      this.round = 1;
      // Give every active team its own full pool.
      const initial =
        this.config.mode === 'time' ? this.config.totalTimeSeconds : this.config.totalTries;
      const pools: Record<string, number> = {};
      for (const id of TEAM_ORDER.slice(0, this.config.teamCount)) pools[id] = initial;
      this.teamPools = pools;

      setTag('mode', this.config.mode);
      setTag('teams', String(this.config.teamCount));
      setTag('rounds', String(this.config.rounds));
      setTag('hardMode', String(this.config.hardMode));
      setTag('lockCorrect', String(this.config.lockCorrect));
      trackEvent('game_started');

      await this.beginRound();
      sound.play('countdown');
    },

    /**
     * Bank each team's live remaining pool before (re)starting the clock, so
     * time-mode leftovers roll over into the next round.
     */
    bankTeamPools(): void {
      if (this.config.mode !== 'time' || this.roundStartedAt == null) return;
      for (const id of Object.keys(this.teamPools)) {
        this.teamPools[id] = this.teamRemaining(id as TeamId);
      }
    },

    /** Host sets up boards + fresh server codes for everyone, then starts clock. */
    async beginRound(): Promise<void> {
      if (!this.isHost) return;
      this.bankTeamPools();
      this.phase = 'playing';
      this.finishOrder = [];
      this.boards = {};
      for (const p of Object.values(this.players)) {
        this.boards[p.id] = emptyBoard(p.id, this.config.codeLength);
        await api.createCode({
          roomCode: this.roomCode,
          playerId: p.id,
          codeLength: this.config.codeLength,
          hardMode: this.config.hardMode,
          round: this.round,
          lockCorrect: this.config.lockCorrect,
        });
      }
      this.roundStartedAt = Date.now();
      await this.broadcast({
        type: 'gameStarted',
        payload: { state: this.snapshot() },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
    },

    // ---------- Guessing ----------

    async submitGuess(guess: number[]): Promise<GuessResult | null> {
      const board = this.boards[this.localPlayerId];
      if (!board || board.status !== 'cracking') return null;
      if (this.config.mode === 'tries' && this.remaining <= 0) return null;

      // Enforce locked positions can't be changed.
      sound.play('submit');
      try {
        const result = await api.validateGuess({
          roomCode: this.roomCode,
          playerId: this.localPlayerId,
          round: this.round,
          guess,
          lockedPositions: board.lockedPositions,
          attemptNumber: board.attemptsUsed + 1,
        });

        const prevLockedCount = board.lockedPositions.length;
        board.history.push(result);
        board.lockedPositions = result.lockedPositions;
        board.attemptsUsed += 1;

        // Play the lock-in chime only when a NEW position just locked green.
        if (this.config.lockCorrect && result.lockedPositions.length > prevLockedCount) {
          sound.play('lockIn');
        }

        // Consume a try from the local TEAM's pool (tries mode).
        if (this.config.mode === 'tries') {
          const tid = this.localTeamId;
          if (tid) {
            this.teamPools[tid] = Math.max(0, (this.teamPools[tid] ?? 0) - 1);
            await this.broadcastPool(tid);
          }
        }

        // Broadcast the guess (feedback only, no secret).
        await this.broadcast({
          type: 'guessMade',
          payload: { playerId: this.localPlayerId, result },
          senderId: this.localPlayerId,
          ts: Date.now(),
        });

        if (result.solved) {
          await this.handleSolved();
        } else {
          sound.play('wrong');
          if (this.config.mode === 'tries' && this.remaining <= 1) {
            this.markFailed(this.localPlayerId);
          }
        }
        return result;
      } catch (err) {
        this.error = (err as Error).message;
        return null;
      }
    },

    async handleSolved(): Promise<void> {
      const board = this.boards[this.localPlayerId];
      if (!board) return;
      board.status = 'solved';
      board.solvedAt = Date.now();
      this.finishOrder.push(this.localPlayerId);

      const rank = this.finishOrder.length;
      const score = this.computeRoundScore(rank);
      board.roundScore = score;
      const player = this.players[this.localPlayerId];
      if (player) {
        player.totalScore += score;
        this.teams[player.teamId].score += score;
      }

      sound.play('win');
      this.showBoosterModal = this.phase === 'playing' && !this.allPlayersDone();
      trackEvent('code_solved');

      await this.broadcast({
        type: 'playerSolved',
        payload: { playerId: this.localPlayerId, roundScore: score, finishRank: rank },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
    },

    computeRoundScore(finishRank: number): number {
      // Faster finishers score more; remaining pool rewards efficiency.
      const base = 1000;
      const rankBonus = Math.max(0, 500 - (finishRank - 1) * 150);
      const efficiency = this.config.mode === 'time' ? this.remaining * 2 : this.remaining * 50;
      const hintPenalty = (this.boards[this.localPlayerId]?.hintsUsed.length ?? 0) * 100;
      return Math.max(0, base + rankBonus + efficiency - hintPenalty);
    },

    markFailed(playerId: string): void {
      const board = this.boards[playerId];
      if (board && board.status === 'cracking') {
        board.status = 'failed';
        board.roundScore = 0;
        if (playerId === this.localPlayerId) sound.play('lose');
      }
    },

    broadcastPool(teamId: TeamId): Promise<void> {
      return this.broadcast({
        type: 'poolUpdated',
        payload: { pool: this.teamPools[teamId] ?? 0, teamId },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
    },

    // ---------- Hints ----------

    async buyHint(): Promise<string | null> {
      const board = this.boards[this.localPlayerId];
      const tid = this.localTeamId;
      if (!board || board.status !== 'cracking' || !tid) return null;
      if (this.remaining <= this.config.hintCost) {
        this.error = 'Not enough time/tries for a hint.';
        return null;
      }
      try {
        const hint = await api.hint({
          roomCode: this.roomCode,
          playerId: this.localPlayerId,
          round: this.round,
        });
        board.hintsUsed.push(hint);
        trackEvent('hint_purchased');

        // Deduct the cost from THIS TEAM's pool only. In time mode we lower the
        // banked value and re-anchor roundStartedAt so the live countdown stays
        // continuous while absorbing the penalty.
        if (this.config.mode === 'time') {
          const liveRemaining = this.teamRemaining(tid);
          this.teamPools[tid] = Math.max(0, liveRemaining - this.config.hintCost);
          // Re-bank all teams against a fresh anchor to keep others' time intact.
          const now = Date.now();
          for (const other of Object.keys(this.teamPools)) {
            if (other !== tid) this.teamPools[other] = this.teamRemaining(other as TeamId);
          }
          this.roundStartedAt = now;
        } else {
          this.teamPools[tid] = Math.max(0, (this.teamPools[tid] ?? 0) - this.config.hintCost);
        }

        sound.play('hint');
        await this.broadcast({
          type: 'hintPurchased',
          payload: { playerId: this.localPlayerId, teamId: tid, hint, newPool: this.teamPools[tid] },
          senderId: this.localPlayerId,
          ts: Date.now(),
        });
        return hint;
      } catch (err) {
        this.error = (err as Error).message;
        return null;
      }
    },

    // ---------- Boosters ----------

    closeBoosterModal(): void {
      this.showBoosterModal = false;
    },

    async chooseBooster(type: BoosterType, targetPlayerId?: string): Promise<void> {
      this.closeBoosterModal();

      if (!this.canChooseBooster) {
        return;
      }

      const player = this.players[this.localPlayerId];
      if (!player) return;
      const step = this.config.mode === 'time' ? 60 : 2;
      const myTeam = player.teamId;
      // Re-anchor time so pool edits apply cleanly to live countdowns.
      if (this.config.mode === 'time') this.bankTeamPools();

      switch (type) {
        case 'teamBoost':
          this.teamPools[myTeam] = (this.teamPools[myTeam] ?? 0) + step;
          this.flashPool(myTeam, +step);
          this.pushNotification({
            kind: 'boost',
            title: 'TEAM BOOST!',
            message: `+${step}${this.config.mode === 'time' ? 's' : ' tries'} to your team.`,
            icon: '⚡',
            color: 'green',
            banner: true,
          });
          sound.play('boost');
          break;
        case 'sabotage':
          for (const id of Object.keys(this.teamPools)) {
            if (id !== myTeam) this.teamPools[id] = Math.max(0, (this.teamPools[id] ?? 0) - step);
          }
          this.pushNotification({
            kind: 'sabotage',
            title: 'SABOTAGE DEPLOYED',
            message: `−${step}${this.config.mode === 'time' ? 's' : ' tries'} from every enemy team.`,
            icon: '💣',
            color: 'red',
            banner: true,
          });
          sound.play('sabotage');
          break;
        case 'difficultyUp':
          sound.play('sabotage');
          // Update enemy boards' displayed length locally on this client.
          this.applyResizeToEnemiesLocal(this.localPlayerId, +1);
          break;
        case 'mercy':
          sound.play('boost');
          this.applyResizeLocal(targetPlayerId ?? this.localPlayerId, -1);
          break;
      }
      if (this.config.mode === 'time') this.roundStartedAt = Date.now();

      trackEvent(`booster_${type}`);

      await this.broadcast({
        type: 'boosterChosen',
        payload: { playerId: this.localPlayerId, booster: type, targetPlayerId },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });

      // If this resize affects OUR own code (e.g. Mercy on self), update Redis.
      await this.resizeOwnCodeIfTargeted(this.localPlayerId, type, targetPlayerId);
      // Push every team's pool so all clients converge.
      for (const id of Object.keys(this.teamPools)) {
        await this.broadcastPool(id as TeamId);
      }
      this.maybeAdvanceRound();
    },

    /**
     * Update a board's displayed code length locally (clamped). Returns the
     * new length, or null if no change. Does NOT touch Redis — the Redis
     * secret is owned and resized by that player's OWN client (see
     * `resizeOwnCodeIfTargeted`) so the server secret and UI stay in sync.
     */
    applyResizeLocal(playerId: string, delta: number): number | null {
      const board = this.boards[playerId];
      if (!board) return null;
      const newLength = Math.max(3, Math.min(8, board.codeLength + delta));
      if (newLength === board.codeLength) return null;
      board.codeLength = newLength;
      // Drop any locked positions that fall outside a shrunken code.
      board.lockedPositions = board.lockedPositions.filter((p) => p < newLength);
      return newLength;
    },

    /** Local display update for all enemy boards (every client runs this). */
    applyResizeToEnemiesLocal(actingPlayerId: string, delta: number): void {
      const actor = this.players[actingPlayerId];
      if (!actor) return;
      for (const p of Object.values(this.players)) {
        if (p.teamId !== actor.teamId) this.applyResizeLocal(p.id, delta);
      }
    },

    /**
     * If THIS client's player is affected by a resize booster, regenerate its
     * own secret code in Redis at the new length. Only the owning client does
     * this, so the server secret always matches what the player sees.
     */
    async resizeOwnCodeIfTargeted(
      actingPlayerId: string,
      type: BoosterType,
      targetPlayerId: string | undefined,
    ): Promise<void> {
      const me = this.players[this.localPlayerId];
      const actor = this.players[actingPlayerId];
      if (!me || !actor) return;

      let affectsMe = false;
      if (type === 'difficultyUp') {
        // Enemies of the actor each gain a digit.
        affectsMe = me.teamId !== actor.teamId;
      } else if (type === 'mercy') {
        // Target (or the actor themselves) loses a digit.
        affectsMe = (targetPlayerId ?? actingPlayerId) === this.localPlayerId;
      }
      if (!affectsMe) return;

      const myBoard = this.boards[this.localPlayerId];
      if (!myBoard) return;
      // Local codeLength was already updated by the display pass; mirror it to Redis.
      await api.resizeCode({
        roomCode: this.roomCode,
        playerId: this.localPlayerId,
        round: this.round,
        newLength: myBoard.codeLength,
      });
    },

    // ---------- Round advancement ----------

    allPlayersDone(): boolean {
      return Object.values(this.boards).every((b) => b.status !== 'cracking');
    },

    /**
     * Fold the just-finished round's per-board data into each player's
     * cumulative stats. Host-only; runs once per round before boards reset.
     */
    foldRoundStats(): void {
      for (const board of Object.values(this.boards)) {
        const p = this.players[board.playerId];
        if (!p) continue;
        p.stats.totalTries += board.attemptsUsed;
        p.stats.hintsUsed += board.hintsUsed.length;
        if (board.solvedAt != null && this.roundStartedAt != null) {
          p.stats.roundsSolved += 1;
          p.stats.totalSolveTime += Math.max(
            0,
            Math.round((board.solvedAt - this.roundStartedAt) / 1000),
          );
        }
      }
    },

    maybeAdvanceRound(): void {
      if (!this.isHost) return;
      if (!this.allPlayersDone()) return;
      this.foldRoundStats();
      if (this.round >= this.config.rounds) {
        void this.finishGame();
      } else {
        this.phase = 'roundTransition';
        void this.syncState();
      }
    },

    async nextRound(): Promise<void> {
      if (!this.isHost) return;
      this.round += 1;
      await this.beginRound();
    },

    async finishGame(): Promise<void> {
      this.phase = 'finished';
      const leaderboard = this.buildLeaderboard();
      this.leaderboard = leaderboard;
      trackEvent('game_finished');
      sound.play(this.winnerIsLocalTeam(leaderboard) ? 'win' : 'lose');
      if (this.isHost) {
        await this.broadcast({
          type: 'gameFinished',
          payload: { leaderboard, state: this.snapshot() },
          senderId: this.localPlayerId,
          ts: Date.now(),
        });
      }
    },

    /**
     * Host-only: end the game immediately for everyone, finalizing scores as
     * they stand. If a round is in progress, its stats are folded in first.
     */
    async endGameNow(): Promise<void> {
      if (!this.isHost || this.phase === 'finished') return;
      // Only fold if a round is actually mid-play (roundTransition already folded).
      if (this.phase === 'playing') this.foldRoundStats();
      this.pushNotification({
        kind: 'info',
        title: 'GAME ENDED',
        message: 'The host ended the game. Final standings are in!',
        icon: '🏁',
        color: 'cyan',
        banner: true,
      });
      await this.finishGame();
    },

    winnerIsLocalTeam(lb: LeaderboardRow[]): boolean {
      const me = this.players[this.localPlayerId];
      return lb.length > 0 && me != null && lb[0].teamId === me.teamId;
    },

    buildLeaderboard(): LeaderboardRow[] {
      const rows: LeaderboardRow[] = Object.values(this.teams).map((team) => {
        const members = Object.values(this.players).filter((p) => p.teamId === team.id);

        const playerRows: LeaderboardPlayerRow[] = members
          .map((m) => ({
            playerId: m.id,
            name: m.name,
            isHost: m.isHost,
            score: m.totalScore,
            totalTries: m.stats.totalTries,
            totalSolveTime: m.stats.totalSolveTime,
            roundsSolved: m.stats.roundsSolved,
            hintsUsed: m.stats.hintsUsed,
          }))
          .sort((a, b) => b.score - a.score);

        return {
          teamId: team.id,
          teamName: team.name,
          score: team.score,
          totalTimeConsumed: playerRows.reduce((a, p) => a + p.totalSolveTime, 0),
          totalTries: playerRows.reduce((a, p) => a + p.totalTries, 0),
          rank: 0,
          players: playerRows,
        };
      });
      rows.sort((a, b) => b.score - a.score);
      rows.forEach((r, i) => (r.rank = i + 1));
      return rows;
    },

    // ---------- Inbound event handling ----------

    handleEvent(e: GameEvent): void {
      // Ignore our own echoes for most events (already applied locally).
      switch (e.type) {
        case 'stateSync':
        case 'gameStarted':
        case 'roundAdvanced':
          if (e.senderId !== this.localPlayerId) this.applySnapshot(e.payload.state);
          if (e.type === 'gameStarted' && e.senderId !== this.localPlayerId) {
            this.phase = 'playing';
          }
          break;

        case 'playerJoined': {
          const p = e.payload.player;
          if (p.id !== this.localPlayerId) {
            this.players[p.id] = p;
            if (this.teams[p.teamId] && !this.teams[p.teamId].memberIds.includes(p.id)) {
              this.teams[p.teamId].memberIds.push(p.id);
            }
          }
          // Host responds with authoritative snapshot.
          if (this.isHost) void this.syncState();
          break;
        }

        case 'playerLeft':
          if (this.players[e.payload.playerId]) {
            this.players[e.payload.playerId].connected = false;
          }
          break;

        case 'teamChanged':
          if (e.senderId !== this.localPlayerId && this.isHost) {
            void this.assignTeam(e.payload.playerId, e.payload.teamId);
          }
          break;

        case 'configUpdated':
          if (e.senderId !== this.localPlayerId) this.config = e.payload.config;
          break;

        case 'guessMade':
          if (e.senderId !== this.localPlayerId) {
            const b = this.boards[e.payload.playerId];
            if (b) {
              b.history.push(e.payload.result);
              b.lockedPositions = e.payload.result.lockedPositions;
              b.attemptsUsed += 1;
            }
          }
          break;

        case 'playerSolved':
          if (e.senderId !== this.localPlayerId) {
            const b = this.boards[e.payload.playerId];
            if (b) {
              b.status = 'solved';
              b.roundScore = e.payload.roundScore;
              b.solvedAt = Date.now();
            }
            if (!this.finishOrder.includes(e.payload.playerId)) {
              this.finishOrder.push(e.payload.playerId);
            }
            const p = this.players[e.payload.playerId];
            if (p) {
              p.totalScore += e.payload.roundScore;
              if (this.teams[p.teamId]) this.teams[p.teamId].score += e.payload.roundScore;
              const me = this.players[this.localPlayerId];
              const sameTeam = me && p.teamId === me.teamId;
              this.pushNotification({
                kind: 'solved',
                title: sameTeam ? 'TEAMMATE CRACKED IT!' : 'CODE CRACKED',
                message: `${p.name} solved their code (+${e.payload.roundScore}).`,
                icon: sameTeam ? '🎉' : '🏁',
                color: sameTeam ? 'green' : 'yellow',
                banner: false,
              });
            }
          }
          if (this.isHost) this.maybeAdvanceRound();
          break;

        case 'poolUpdated':
          if (e.senderId !== this.localPlayerId) {
            const prev = this.teamPools[e.payload.teamId] ?? e.payload.pool;
            this.teamPools[e.payload.teamId] = e.payload.pool;
            // Re-anchor time so remote pool edits reflect in live countdown.
            if (this.config.mode === 'time') this.roundStartedAt = Date.now();
            // Flash a delta on that team's meter (tries-mode guesses excluded:
            // -1 drip would be noisy; only flash meaningful jumps).
            const delta = Math.round(e.payload.pool - prev);
            if (Math.abs(delta) >= (this.config.mode === 'time' ? 5 : 2)) {
              this.flashPool(e.payload.teamId, delta);
            }
          }
          break;

        case 'hintPurchased':
          if (e.senderId !== this.localPlayerId) {
            this.teamPools[e.payload.teamId] = e.payload.newPool;
            if (this.config.mode === 'time') this.roundStartedAt = Date.now();
            // Surface the teammate's hint on their board log.
            const hb = this.boards[e.payload.playerId];
            if (hb && !hb.hintsUsed.includes(e.payload.hint)) hb.hintsUsed.push(e.payload.hint);
            const hp = this.players[e.payload.playerId];
            const me = this.players[this.localPlayerId];
            if (hp && me && hp.teamId === me.teamId) {
              this.flashPool(e.payload.teamId, -this.config.hintCost);
              this.pushNotification({
                kind: 'hint',
                title: 'HINT UNLOCKED',
                message: `${hp.name}: ${e.payload.hint}`,
                icon: '🧩',
                color: 'yellow',
                banner: false,
              });
            }
          }
          break;

        case 'boosterChosen':
          if (e.senderId !== this.localPlayerId) {
            const { playerId: actorId, booster, targetPlayerId } = e.payload;
            // Mirror the resize's DISPLAY effect on this client's boards.
            if (booster === 'difficultyUp') {
              this.applyResizeToEnemiesLocal(actorId, +1);
            } else if (booster === 'mercy') {
              this.applyResizeLocal(targetPlayerId ?? actorId, -1);
            }
            // If OUR own code was resized, regenerate it in Redis so the
            // server secret matches our new number of slots.
            void this.resizeOwnCodeIfTargeted(actorId, booster, targetPlayerId);
            // Raise an animated notification relative to this client.
            this.notifyBooster(actorId, booster, targetPlayerId);
          }
          break;

        case 'gameFinished':
          this.phase = 'finished';
          this.leaderboard = e.payload.leaderboard;
          if (e.senderId !== this.localPlayerId) this.applySnapshot(e.payload.state);
          break;
      }
    },

    // ---------- Notifications ----------

    pushNotification(n: Omit<GameNotification, 'id' | 'ts'>): void {
      const note: GameNotification = {
        ...n,
        id: Math.random().toString(36).slice(2),
        ts: Date.now(),
      };
      this.notifications.push(note);
      // Auto-expire: banners linger a touch longer than toasts.
      const ttl = note.banner ? 3800 : 2800;
      window.setTimeout(() => this.dismissNotification(note.id), ttl);
    },

    dismissNotification(id: string): void {
      this.notifications = this.notifications.filter((n) => n.id !== id);
    },

    /** Flash a floating +/- pool delta label on a team's meter. */
    flashPool(teamId: TeamId, delta: number): void {
      if (delta === 0) return;
      const id = Math.random().toString(36).slice(2);
      this.poolFlash[teamId] = { id, delta, ts: Date.now() };
      window.setTimeout(() => {
        if (this.poolFlash[teamId]?.id === id) this.poolFlash[teamId] = undefined;
      }, 1600);
    },

    /**
     * Derive and raise a notification from a booster, relative to THIS client.
     * amount = pool step used, in seconds or tries.
     */
    notifyBooster(actorId: string, booster: BoosterType, targetPlayerId: string | undefined): void {
      const me = this.players[this.localPlayerId];
      const actor = this.players[actorId];
      if (!me || !actor) return;
      const sameTeam = actor.teamId === me.teamId;
      const step = this.config.mode === 'time' ? 60 : 2;
      const unit = this.config.mode === 'time' ? 's' : ' tries';
      const actorTeam = this.teams[actor.teamId]?.name ?? 'A team';

      switch (booster) {
        case 'teamBoost':
          if (sameTeam) {
            this.flashPool(me.teamId, +step);
            this.pushNotification({
              kind: 'boost',
              title: 'TEAM BOOST!',
              message: `${actor.name} added +${step}${unit} to your team.`,
              icon: '⚡',
              color: 'green',
              banner: true,
            });
            sound.play('boost');
          }
          break;
        case 'sabotage':
          if (!sameTeam) {
            this.flashPool(me.teamId, -step);
            this.pushNotification({
              kind: 'sabotage',
              title: 'SABOTAGED!',
              message: `${actorTeam} ripped −${step}${unit} from your team!`,
              icon: '💣',
              color: 'red',
              banner: true,
            });
            sound.play('sabotage');
          }
          break;
        case 'difficultyUp':
          if (!sameTeam) {
            this.pushNotification({
              kind: 'difficultyUp',
              title: 'CODE SCRAMBLED!',
              message: `${actorTeam} added a digit to your code. It's longer now!`,
              icon: '🔥',
              color: 'magenta',
              banner: true,
            });
            sound.play('sabotage');
          }
          break;
        case 'mercy': {
          const target = targetPlayerId ?? actorId;
          if (target === this.localPlayerId) {
            this.pushNotification({
              kind: 'mercy',
              title: 'MERCY GRANTED',
              message: `${actor.name} removed a digit from your code. Easier now!`,
              icon: '🕊️',
              color: 'cyan',
              banner: true,
            });
            sound.play('boost');
          }
          break;
        }
      }
    },

    // ---------- Chat (global channel, available everywhere) ----------

    /**
     * Connect to the global chat channel. Idempotent — safe to call on app
     * mount and again after joining a room. Assigns a stable id + fun alias
     * the first time so pre-join messages have a name.
     */
    async initChat(): Promise<void> {
      if (!this.chatId) this.chatId = genId();
      if (!this.chatAlias) this.chatAlias = randomAlias();
      try {
        await chatService.connect(this.chatId);
        chatService.onMessage((m) => this.receiveChat(m));
        this.chatReady = true;
      } catch {
        this.chatReady = false;
      }
    },

    /** The name to show for our chat messages — real name if joined, else alias. */
    chatDisplayName(): string {
      const me = this.players[this.localPlayerId];
      return me?.name || this.chatAlias || 'Anonymous';
    },

    async sendChat(text: string): Promise<void> {
      const trimmed = text.trim().slice(0, 200);
      if (!trimmed) return;
      if (!this.chatReady) await this.initChat();
      const me = this.players[this.localPlayerId];
      const message: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        playerId: me?.id || this.chatId,
        playerName: this.chatDisplayName(),
        teamId: me?.teamId,
        text: trimmed,
        ts: Date.now(),
        anonymous: !me,
      };
      this.chat.push(message);
      if (this.chat.length > 200) this.chat = this.chat.slice(-200);
      await chatService.publish(message);
    },

    receiveChat(message: ChatMessage): void {
      // Skip our own echo (we already appended it locally).
      if (message.playerId === (this.players[this.localPlayerId]?.id || this.chatId)) return;
      if (this.chat.some((m) => m.id === message.id)) return;
      this.chat.push(message);
      if (this.chat.length > 200) this.chat = this.chat.slice(-200);
      this.unreadChat += 1;
    },

    clearUnreadChat(): void {
      this.unreadChat = 0;
    },

    tick(): void {
      this.elapsedTick++;
      if (this.phase !== 'playing' || this.config.mode !== 'time') return;
      // Fail still-cracking players whose TEAM pool has run out.
      for (const b of Object.values(this.boards)) {
        if (b.status !== 'cracking') continue;
        const p = this.players[b.playerId];
        if (p && this.teamRemaining(p.teamId) <= 0) this.markFailed(b.playerId);
      }
      if (this.isHost) this.maybeAdvanceRound();
    },

    reset(): void {
      void ablyService.disconnect();
      // Keep the global chat connection alive across games; just clear room state.
      const keepChatId = this.chatId;
      const keepAlias = this.chatAlias;
      const keepChat = this.chat;
      const keepReady = this.chatReady;
      this.$reset();
      this.chatId = keepChatId;
      this.chatAlias = keepAlias;
      this.chat = keepChat;
      this.chatReady = keepReady;
    },
  },
});
