// Shared game types for Codebreakers.

export interface Attempt {
  guess: string
  exact: number
  misplaced: number
}

export interface SolvedInfo {
  points: number
  place: number
}

export interface Player {
  id: string
  name: string
  score: number
  /** round number -> list of attempts (newest first) */
  attempts: Record<number, Attempt[]>
  /** round number -> solve info (present only once solved) */
  solved: Record<number, SolvedInfo>
}

export interface GameSettings {
  minutes: number
  rounds: number
  repeats: boolean
}

export type RoomStatus = 'lobby' | 'playing'

export interface Room {
  code: string
  host: string
  players: Player[]
  settings: GameSettings
  round: number
  status: RoomStatus
  /** The secret code for the current round. Only meaningful while playing. */
  secret?: string
  /** Epoch ms when the current round started. */
  started?: number
  /** Epoch ms when the current round ends. */
  ends?: number
}

/** Events exchanged over the Ably channel for a room. */
export type RealtimeEvent =
  | { type: 'room-state'; room: Room }
  | { type: 'join'; player: Player }
  | { type: 'leave'; playerId: string }
  | { type: 'guess'; playerId: string; guess: string }
  | { type: 'request-state'; playerId: string }
