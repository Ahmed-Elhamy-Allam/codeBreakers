/**
 * CodeBreakers — Domain models, game-state types, and Ably messaging contracts.
 *
 * SECURITY INVARIANT: The secret code is NEVER represented in any client-facing
 * type. `secretLength` (how many digits) is public; the digits themselves live
 * only in Vercel KV and are checked by the serverless validator in /api.
 */

// ------------------------------------------------------------------
// Configuration enums / unions
// ------------------------------------------------------------------

/** How a round is bounded. The clock is a SHARED team pool. */
export type GameMode = 'time' | 'tries';

export const TOTAL_ROUNDS = 3 as const;

/** Max teams a host may create. */
export type TeamCount = 2 | 3 | 4;

/** Stable team identifiers / colors. */
export type TeamId = 'alpha' | 'bravo' | 'charlie' | 'delta';

export const TEAM_ORDER: TeamId[] = ['alpha', 'bravo', 'charlie', 'delta'];

export interface TeamMeta {
  id: TeamId;
  name: string;
  /** Tailwind neon color key used across the UI. */
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
}

export const TEAM_META: Record<TeamId, TeamMeta> = {
  alpha: { id: 'alpha', name: 'Alpha', color: 'cyan' },
  bravo: { id: 'bravo', name: 'Bravo', color: 'magenta' },
  charlie: { id: 'charlie', name: 'Charlie', color: 'yellow' },
  delta: { id: 'delta', name: 'Delta', color: 'green' },
};

// ------------------------------------------------------------------
// Players & teams
// ------------------------------------------------------------------

/** Cumulative per-player stats across all rounds (for the final standings). */
export interface PlayerStats {
  /** Total guesses made across all rounds. */
  totalTries: number;
  /** Total seconds spent on rounds the player solved. */
  totalSolveTime: number;
  /** How many of the rounds this player solved. */
  roundsSolved: number;
  /** Total hints purchased across all rounds. */
  hintsUsed: number;
}

export function emptyStats(): PlayerStats {
  return { totalTries: 0, totalSolveTime: 0, roundsSolved: 0, hintsUsed: 0 };
}

export interface Player {
  id: string; // stable client id (also used as Ably clientId)
  name: string;
  teamId: TeamId;
  isHost: boolean;
  connected: boolean;
  /** Score accumulated across all finished rounds. */
  totalScore: number;
  /** Cumulative stats across rounds. */
  stats: PlayerStats;
}

export interface Team {
  id: TeamId;
  name: string;
  memberIds: string[];
  /** Cumulative score across rounds. */
  score: number;
}

// ------------------------------------------------------------------
// Room configuration (set by host in the lobby)
// ------------------------------------------------------------------

export interface RoomConfig {
  mode: GameMode;
  /** Time mode: total SHARED seconds for the whole game (default 600 = 10 min). */
  totalTimeSeconds: number;
  /** Tries mode: total SHARED tries for the whole game (default 30). */
  totalTries: number;
  teamCount: TeamCount;
  /** Hard mode => repeated digits allowed (harder). Easy => unique digits. */
  hardMode: boolean;
  /** Starting number of digits in each secret code (default 4). */
  codeLength: number;
  /** Hint cost. In time mode = seconds; in tries mode = tries. */
  hintCost: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  mode: 'time',
  totalTimeSeconds: 600,
  totalTries: 30,
  teamCount: 2,
  hardMode: false,
  codeLength: 4,
  hintCost: 60,
};

// ------------------------------------------------------------------
// Guessing & feedback
// ------------------------------------------------------------------

/** Per-slot feedback for a single guess. */
export type SlotFeedback = 'correct' | 'present' | 'absent';

/**
 * Result of validating one guess. Produced server-side so the secret
 * is never exposed. `locked` is the running set of positions that are
 * permanently solved (green) and must stay fixed on later tries.
 */
export interface GuessResult {
  guess: number[];
  /** Per-position feedback aligned to `guess`. */
  feedback: SlotFeedback[];
  /** Count of digits that are correct AND in the right place. */
  correctCount: number;
  /** Count of digits present in the code but in the wrong place. */
  presentCount: number;
  /** Positions permanently locked green (0-indexed), cumulative. */
  lockedPositions: number[];
  /** True once every position is correct. */
  solved: boolean;
  /** 1-indexed guess number for this player this round. */
  attemptNumber: number;
}

// ------------------------------------------------------------------
// Boosters / destroyers (chosen after cracking a code)
// ------------------------------------------------------------------

export type BoosterType = 'teamBoost' | 'sabotage' | 'difficultyUp' | 'mercy';

export interface Booster {
  type: BoosterType;
  label: string;
  description: string;
  /** Emoji/icon used in the modal. */
  icon: string;
}

export const BOOSTERS: Record<BoosterType, Booster> = {
  teamBoost: {
    type: 'teamBoost',
    label: 'Team Boost',
    description: '+1 min (or +2 tries) to your whole team.',
    icon: '⚡',
  },
  sabotage: {
    type: 'sabotage',
    label: 'Sabotage',
    description: '-1 min (or -2 tries) from every enemy team.',
    icon: '💣',
  },
  difficultyUp: {
    type: 'difficultyUp',
    label: 'Difficulty Up',
    description: '+1 digit to all enemy codes for the rest of the round.',
    icon: '🔥',
  },
  mercy: {
    type: 'mercy',
    label: 'Mercy',
    description: '-1 digit from your own / a teammate code.',
    icon: '🕊️',
  },
};

// ------------------------------------------------------------------
// Per-player round state (client-visible; no secret)
// ------------------------------------------------------------------

export type PlayerRoundStatus = 'cracking' | 'solved' | 'failed';

export interface PlayerBoard {
  playerId: string;
  status: PlayerRoundStatus;
  /** Current number of digits in this player's code (mutated by boosters). */
  codeLength: number;
  /** Full guess history this round. */
  history: GuessResult[];
  lockedPositions: number[];
  attemptsUsed: number;
  /** Points earned this round (0 if failed). */
  roundScore: number;
  /** Hints purchased this round (text clues). */
  hintsUsed: string[];
  /** ms timestamp the player solved, used for finish ordering. */
  solvedAt: number | null;
}

// ------------------------------------------------------------------
// Overall game state
// ------------------------------------------------------------------

export type GamePhase = 'lobby' | 'playing' | 'roundTransition' | 'finished';

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  config: RoomConfig;
  round: number; // 1..TOTAL_ROUNDS
  players: Record<string, Player>;
  teams: Record<string, Team>;
  boards: Record<string, PlayerBoard>;
  /**
   * Per-TEAM pool: seconds (time mode) or tries (tries mode) remaining.
   * Each team has its own pool — hints/boosters only affect the acting team.
   * In time mode this is the pool value "banked" at the last round start;
   * live remaining time subtracts elapsed since `roundStartedAt`.
   */
  teamPools: Record<string, number>;
  /** Server (host) epoch ms when the current round's clock started. */
  roundStartedAt: number | null;
  /** Finish order (playerIds) for the current round. */
  finishOrder: string[];
}

export interface LeaderboardPlayerRow {
  playerId: string;
  name: string;
  isHost: boolean;
  score: number;
  totalTries: number;
  totalSolveTime: number;
  roundsSolved: number;
  hintsUsed: number;
}

export interface LeaderboardRow {
  teamId: TeamId;
  teamName: string;
  score: number;
  totalTimeConsumed: number;
  totalTries: number;
  rank: number;
  /** Per-player breakdown, best scorer first. */
  players: LeaderboardPlayerRow[];
}

// ------------------------------------------------------------------
// Ably messaging contracts (discriminated union over `type`)
// ------------------------------------------------------------------

export type GameEventType =
  | 'stateSync'
  | 'playerJoined'
  | 'playerLeft'
  | 'teamChanged'
  | 'configUpdated'
  | 'gameStarted'
  | 'guessMade'
  | 'playerSolved'
  | 'boosterChosen'
  | 'poolUpdated'
  | 'roundAdvanced'
  | 'gameFinished'
  | 'hintPurchased';

interface BaseEvent<T extends GameEventType, P> {
  type: T;
  payload: P;
  senderId: string;
  ts: number;
}

export type StateSyncEvent = BaseEvent<'stateSync', { state: GameState }>;
export type PlayerJoinedEvent = BaseEvent<'playerJoined', { player: Player }>;
export type PlayerLeftEvent = BaseEvent<'playerLeft', { playerId: string }>;
export type TeamChangedEvent = BaseEvent<'teamChanged', { playerId: string; teamId: TeamId }>;
export type ConfigUpdatedEvent = BaseEvent<'configUpdated', { config: RoomConfig }>;
export type GameStartedEvent = BaseEvent<'gameStarted', { state: GameState }>;
export type GuessMadeEvent = BaseEvent<'guessMade', { playerId: string; result: GuessResult }>;
export type PlayerSolvedEvent = BaseEvent<
  'playerSolved',
  { playerId: string; roundScore: number; finishRank: number }
>;
export type BoosterChosenEvent = BaseEvent<
  'boosterChosen',
  { playerId: string; booster: BoosterType; targetPlayerId?: string }
>;
export type PoolUpdatedEvent = BaseEvent<'poolUpdated', { pool: number; teamId: TeamId }>;
export type RoundAdvancedEvent = BaseEvent<'roundAdvanced', { state: GameState }>;
export type GameFinishedEvent = BaseEvent<
  'gameFinished',
  { leaderboard: LeaderboardRow[]; state: GameState }
>;
export type HintPurchasedEvent = BaseEvent<
  'hintPurchased',
  { playerId: string; teamId: TeamId; hint: string; newPool: number }
>;

export type GameEvent =
  | StateSyncEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | TeamChangedEvent
  | ConfigUpdatedEvent
  | GameStartedEvent
  | GuessMadeEvent
  | PlayerSolvedEvent
  | BoosterChosenEvent
  | PoolUpdatedEvent
  | RoundAdvancedEvent
  | GameFinishedEvent
  | HintPurchasedEvent;

// ------------------------------------------------------------------
// Serverless API request/response contracts
// ------------------------------------------------------------------

export interface AblyTokenResponse {
  // Shape of Ably.TokenRequest (passed straight to the client SDK).
  keyName: string;
  ttl: number;
  capability: string;
  clientId: string;
  timestamp: number;
  nonce: string;
  mac: string;
}

export interface CreateCodeRequest {
  roomCode: string;
  playerId: string;
  codeLength: number;
  hardMode: boolean;
  round: number;
}

export interface CreateCodeResponse {
  ok: true;
  codeLength: number;
}

export interface ValidateGuessRequest {
  roomCode: string;
  playerId: string;
  round: number;
  guess: number[];
  /** Positions already locked (sent so the server can enforce them). */
  lockedPositions: number[];
  attemptNumber: number;
}

export interface ValidateGuessResponse {
  ok: true;
  result: GuessResult;
}

export interface HintRequest {
  roomCode: string;
  playerId: string;
  round: number;
}

export interface HintResponse {
  ok: true;
  hint: string;
}

export interface ApiError {
  ok: false;
  error: string;
}
