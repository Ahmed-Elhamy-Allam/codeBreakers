import { defineStore } from 'pinia'
import type { Attempt, GameSettings, Player, Room } from '@/types/game'

export type { Attempt, GameSettings, Player, Room, RoomStatus } from '@/types/game'

export type Page = 'home' | 'lobby' | 'game'

/** Stable per-tab identity, mirrors the demo's sessionStorage player id. */
function ensurePlayerId(): string {
  let id = sessionStorage.getItem('cb-player')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('cb-player', id)
  }
  return id
}

function makePlayer(id: string, name: string): Player {
  return { id, name: name.slice(0, 18), score: 0, attempts: {}, solved: {} }
}

/** Secure random 4-digit code, optionally allowing repeated digits. */
function makeSecret(repeats: boolean): string {
  const a: number[] = []
  while (a.length < 4) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10
    if (repeats || !a.includes(n)) a.push(n)
  }
  return a.join('')
}

interface State {
  playerId: string
  page: Page
  room: Room | null
  now: number
  error: string
}

export const useGameStore = defineStore('game', {
  state: (): State => ({
    playerId: ensurePlayerId(),
    page: 'home',
    room: null,
    now: Date.now(),
    error: '',
  }),

  getters: {
    me(state): Player | undefined {
      return state.room?.players.find((p) => p.id === state.playerId)
    },
    isHost(state): boolean {
      return state.room?.host === state.playerId
    },
    round(state): number {
      return state.room?.round ?? 1
    },
    remaining(state): number {
      const r = state.room
      if (!r || !r.ends) return (r?.settings.minutes ?? 5) * 60
      return Math.min(
        r.settings.minutes * 60,
        Math.max(0, Math.ceil((r.ends - state.now) / 1000)),
      )
    },
    timerText(): string {
      const rem = this.remaining
      return `${Math.floor(rem / 60)
        .toString()
        .padStart(2, '0')}:${(rem % 60).toString().padStart(2, '0')}`
    },
    attempts(): Attempt[] {
      return this.me?.attempts?.[this.round] ?? []
    },
    solved(): boolean {
      return !!this.me?.solved?.[this.round]
    },
    finished(state): boolean {
      if (state.page !== 'game' || !state.room) return false
      return (
        this.remaining === 0 ||
        state.room.players.every((p) => p.solved?.[this.round])
      )
    },
    ranked(state): Player[] {
      return [...(state.room?.players ?? [])].sort((a, b) => b.score - a.score)
    },
  },

  actions: {
    tick() {
      this.now = Date.now()
    },

    /** Replace the local room mirror (used by non-host players). */
    setRoom(room: Room | null) {
      this.room = room
    },

    /** Create a brand-new room with the current player as host. */
    createRoom(name: string): Room {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase()
      const player = makePlayer(this.playerId, name.trim())
      this.room = {
        code,
        host: this.playerId,
        players: [player],
        settings: { minutes: 5, rounds: 3, repeats: false },
        round: 1,
        status: 'lobby',
      }
      this.page = 'lobby'
      return this.room
    },

    /**
     * Prepare the local player object the client will announce to the host
     * after connecting to the room channel.
     */
    buildSelf(name: string): Player {
      return makePlayer(this.playerId, name.trim())
    },

    /** HOST: add a joining player if not already present. */
    hostAddPlayer(player: Player) {
      if (!this.room) return
      if (this.room.players.length >= 12) return
      if (!this.room.players.some((p) => p.id === player.id)) {
        this.room.players.push(player)
      }
    },

    /** HOST: remove a leaving player; reassign host if needed. */
    hostRemovePlayer(playerId: string) {
      if (!this.room) return
      this.room.players = this.room.players.filter((p) => p.id !== playerId)
      if (this.room.host === playerId) {
        this.room.host = this.room.players[0]?.id ?? this.playerId
      }
    },

    /** HOST: apply a settings change. */
    setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
      if (!this.room || !this.isHost) return
      this.room.settings[key] = value
    },

    /** HOST: start round one (or the next round). */
    startRound(next = false) {
      if (!this.room || !this.isHost) return
      const r = this.room
      r.round = next ? r.round + 1 : 1
      if (!next) {
        r.players.forEach((p) => {
          p.score = 0
          p.attempts = {}
          p.solved = {}
        })
      }
      r.status = 'playing'
      r.secret = makeSecret(r.settings.repeats)
      r.started = Date.now()
      r.ends = r.started + r.settings.minutes * 60000
      this.page = 'game'
    },

    /** HOST: return the room to the lobby. */
    backToLobby() {
      if (this.room && this.isHost) this.room.status = 'lobby'
      this.page = 'lobby'
    },

    /**
     * HOST: score a guess from a player and record the attempt.
     * Returns true if this guess solved the code.
     */
    hostScoreGuess(playerId: string, guess: string): boolean {
      const r = this.room
      if (!r || r.status !== 'playing' || !r.secret || !r.ends) return false
      if (Date.now() >= r.ends) return false
      const p = r.players.find((x) => x.id === playerId)
      if (!p || p.solved[r.round]) return false

      let exact = 0
      const a: string[] = []
      const b: string[] = []
      for (let i = 0; i < 4; i++) {
        if (guess[i] === r.secret[i]) exact++
        else {
          a.push(guess[i])
          b.push(r.secret[i])
        }
      }
      let misplaced = 0
      for (const c of a) {
        const i = b.indexOf(c)
        if (i >= 0) {
          misplaced++
          b.splice(i, 1)
        }
      }
      ;(p.attempts[r.round] ??= []).unshift({ guess, exact, misplaced })

      if (exact === 4) {
        const place = r.players.filter((x) => x.solved[r.round]).length + 1
        const points =
          Math.max(100, Math.round((1000 * (r.ends - Date.now())) / (r.ends - r.started!))) +
          Math.max(0, 130 - place * 30)
        p.solved[r.round] = { points, place }
        p.score += points
        return true
      }
      return false
    },

    leaveRoom() {
      this.room = null
      this.page = 'home'
      this.error = ''
    },
  },
})
