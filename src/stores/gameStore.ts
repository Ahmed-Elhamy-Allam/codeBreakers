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
  TOTAL_ROUNDS,
  type BoosterType,
  type GameEvent,
  type GamePhase,
  type GameState,
  type GuessResult,
  type LeaderboardRow,
  type Player,
  type PlayerBoard,
  type RoomConfig,
  type Team,
  type TeamId,
} from '@/types/game';
import { ablyService } from '@/services/ably';
import { api } from '@/services/api';
import { sound } from '@/services/SoundService';

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
  sharedPool: number;
  roundStartedAt: number | null;
  finishOrder: string[];
  leaderboard: LeaderboardRow[];
  connecting: boolean;
  error: string | null;
  // UI state
  showBoosterModal: boolean;
  elapsedTick: number; // forces reactive timer recompute
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
    sharedPool: 0,
    roundStartedAt: null,
    finishOrder: [],
    leaderboard: [],
    connecting: false,
    error: null,
    showBoosterModal: false,
    elapsedTick: 0,
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
    /** Seconds (time mode) or tries (tries mode) remaining, live. */
    remaining(state): number {
      void state.elapsedTick; // dependency to re-run each tick
      if (state.config.mode === 'tries') return state.sharedPool;
      if (state.phase !== 'playing' || state.roundStartedAt == null) return state.sharedPool;
      const elapsed = Math.floor((Date.now() - state.roundStartedAt) / 1000);
      return Math.max(0, state.sharedPool - elapsed);
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
        };
        this.players = { [player.id]: player };
        this.teams.alpha.memberIds = [player.id];

        await this.connectAbly(roomCode);
        return roomCode;
      } catch (err) {
        this.error = (err as Error).message;
        throw err;
      } finally {
        this.connecting = false;
      }
    },

    async joinRoom(playerName: string, roomCode: string, teamId: TeamId): Promise<void> {
      this.connecting = true;
      this.error = null;
      try {
        this.localPlayerId = genId();
        this.roomCode = roomCode.toUpperCase();

        const player: Player = {
          id: this.localPlayerId,
          name: playerName,
          teamId,
          isHost: false,
          connected: true,
          totalScore: 0,
        };
        this.players = { [player.id]: player };

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
        sharedPool: this.sharedPool,
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
      this.sharedPool = s.sharedPool;
      this.roundStartedAt = s.roundStartedAt;
      this.finishOrder = s.finishOrder;
    },

    // ---------- Game start & rounds ----------

    async startGame(): Promise<void> {
      if (!this.isHost) return;
      this.round = 1;
      this.sharedPool =
        this.config.mode === 'time' ? this.config.totalTimeSeconds : this.config.totalTries;
      await this.beginRound();
      sound.play('countdown');
    },

    /** Host sets up boards + fresh server codes for everyone, then starts clock. */
    async beginRound(): Promise<void> {
      if (!this.isHost) return;
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

        board.history.push(result);
        board.lockedPositions = result.lockedPositions;
        board.attemptsUsed += 1;

        if (result.lockedPositions.length > board.lockedPositions.length - 1) {
          sound.play('lockIn');
        }

        // Consume a try from the shared pool (tries mode).
        if (this.config.mode === 'tries') {
          this.sharedPool = Math.max(0, this.sharedPool - 1);
          await this.broadcastPool(board.playerId);
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
      this.showBoosterModal = true;

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

    broadcastPool(teamId?: string): Promise<void> {
      const player = this.players[this.localPlayerId];
      return this.broadcast({
        type: 'poolUpdated',
        payload: { sharedPool: this.sharedPool, teamId: (teamId as TeamId) ?? player?.teamId },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
    },

    // ---------- Hints ----------

    async buyHint(): Promise<string | null> {
      const board = this.boards[this.localPlayerId];
      if (!board || board.status !== 'cracking') return null;
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

        // Deduct the cost from the shared pool.
        if (this.config.mode === 'tries') {
          this.sharedPool = Math.max(0, this.sharedPool - this.config.hintCost);
        } else {
          // Time mode: shift round start so elapsed effectively grows.
          this.sharedPool = Math.max(0, this.sharedPool - this.config.hintCost);
        }
        sound.play('hint');
        await this.broadcast({
          type: 'hintPurchased',
          payload: { playerId: this.localPlayerId, hint, newPool: this.sharedPool },
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

    async chooseBooster(type: BoosterType, targetPlayerId?: string): Promise<void> {
      this.showBoosterModal = false;
      const player = this.players[this.localPlayerId];
      if (!player) return;
      const step = this.config.mode === 'time' ? 60 : 2;

      switch (type) {
        case 'teamBoost':
          this.sharedPool += step;
          sound.play('boost');
          break;
        case 'sabotage':
          this.sharedPool = Math.max(0, this.sharedPool - step);
          sound.play('sabotage');
          break;
        case 'difficultyUp':
          sound.play('sabotage');
          await this.applyResizeToEnemies(+1);
          break;
        case 'mercy':
          sound.play('boost');
          await this.applyResize(targetPlayerId ?? this.localPlayerId, -1);
          break;
      }

      await this.broadcast({
        type: 'boosterChosen',
        payload: { playerId: this.localPlayerId, booster: type, targetPlayerId },
        senderId: this.localPlayerId,
        ts: Date.now(),
      });
      await this.broadcastPool();
      this.maybeAdvanceRound();
    },

    async applyResize(playerId: string, delta: number): Promise<void> {
      const board = this.boards[playerId];
      if (!board) return;
      const newLength = Math.max(3, Math.min(8, board.codeLength + delta));
      if (newLength === board.codeLength) return;
      board.codeLength = newLength;
      if (playerId === this.localPlayerId) {
        await api.resizeCode({
          roomCode: this.roomCode,
          playerId,
          round: this.round,
          newLength,
        });
      }
    },

    async applyResizeToEnemies(delta: number): Promise<void> {
      const me = this.players[this.localPlayerId];
      if (!me) return;
      for (const p of Object.values(this.players)) {
        if (p.teamId !== me.teamId) await this.applyResize(p.id, delta);
      }
    },

    // ---------- Round advancement ----------

    allPlayersDone(): boolean {
      return Object.values(this.boards).every((b) => b.status !== 'cracking');
    },

    maybeAdvanceRound(): void {
      if (!this.isHost) return;
      if (!this.allPlayersDone()) return;
      if (this.round >= TOTAL_ROUNDS) {
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

    winnerIsLocalTeam(lb: LeaderboardRow[]): boolean {
      const me = this.players[this.localPlayerId];
      return lb.length > 0 && me != null && lb[0].teamId === me.teamId;
    },

    buildLeaderboard(): LeaderboardRow[] {
      const rows: LeaderboardRow[] = Object.values(this.teams).map((team) => {
        const members = Object.values(this.players).filter((p) => p.teamId === team.id);
        const boards = members
          .map((m) => this.boards[m.id])
          .filter((b): b is PlayerBoard => Boolean(b));
        const totalTries = boards.reduce((a, b) => a + b.attemptsUsed, 0);
        const solved = boards.filter((b) => b.solvedAt != null);
        const totalTime =
          solved.length && this.roundStartedAt
            ? solved.reduce((a, b) => a + ((b.solvedAt ?? 0) - (this.roundStartedAt ?? 0)) / 1000, 0)
            : 0;
        return {
          teamId: team.id,
          teamName: team.name,
          score: team.score,
          totalTimeConsumed: Math.round(totalTime),
          totalTries,
          rank: 0,
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
            }
          }
          if (this.isHost) this.maybeAdvanceRound();
          break;

        case 'poolUpdated':
          if (e.senderId !== this.localPlayerId) this.sharedPool = e.payload.sharedPool;
          break;

        case 'hintPurchased':
          if (e.senderId !== this.localPlayerId) this.sharedPool = e.payload.newPool;
          break;

        case 'boosterChosen':
          if (e.senderId !== this.localPlayerId) {
            // Non-authoritative clients just rely on the following poolUpdated /
            // stateSync; resize effects on own board handled via stateSync.
          }
          break;

        case 'gameFinished':
          this.phase = 'finished';
          this.leaderboard = e.payload.leaderboard;
          if (e.senderId !== this.localPlayerId) this.applySnapshot(e.payload.state);
          break;
      }
    },

    tick(): void {
      this.elapsedTick++;
      if (this.phase === 'playing' && this.config.mode === 'time' && this.remaining <= 0) {
        // Time's up — fail any still-cracking players.
        for (const b of Object.values(this.boards)) {
          if (b.status === 'cracking') this.markFailed(b.playerId);
        }
        if (this.isHost) this.maybeAdvanceRound();
      }
    },

    reset(): void {
      void ablyService.disconnect();
      this.$reset();
    },
  },
});
