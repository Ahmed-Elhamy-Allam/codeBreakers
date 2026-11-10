import { defineStore } from 'pinia'

export interface Player {
  id: string
  nickname: string
  score: number
}

type Status = 'idle' | 'lobby' | 'playing' | 'finished'

interface GameState {
  pin: string
  status: Status
  players: Player[]
  me: Player | null
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    pin: '',
    status: 'idle',
    players: [],
    me: null,
  }),

  actions: {
    setPin(pin: string) {
      this.pin = pin
    },
    setMe(player: Player) {
      this.me = player
    },
    updatePlayers(players: Player[]) {
      this.players = players
    },
    addPlayer(player: Player) {
      if (!this.players.some((p) => p.id === player.id)) {
        this.players.push(player)
      }
    },
    setStatus(status: Status) {
      this.status = status
    },
    reset() {
      this.$reset()
    },
  },
})
