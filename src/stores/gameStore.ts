import { defineStore } from 'pinia'
import { snippets, type Snippet } from '@/data/snippets'

interface GameState {
  rounds: Snippet[]
  current: number
  score: number
  answers: { snippetId: number; choice: string; correct: boolean }[]
  started: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    rounds: [],
    current: 0,
    score: 0,
    answers: [],
    started: false,
  }),

  getters: {
    totalRounds: (state) => state.rounds.length,
    currentSnippet: (state): Snippet | undefined => state.rounds[state.current],
    isFinished: (state) => state.started && state.current >= state.rounds.length,
    shuffledOptions(): string[] {
      const snippet = this.currentSnippet
      return snippet ? shuffle(snippet.options) : []
    },
  },

  actions: {
    start() {
      this.rounds = shuffle(snippets)
      this.current = 0
      this.score = 0
      this.answers = []
      this.started = true
    },

    answer(choice: string) {
      const snippet = this.currentSnippet
      if (!snippet) return
      const correct = choice === snippet.language
      if (correct) this.score += 100
      this.answers.push({ snippetId: snippet.id, choice, correct })
      this.current += 1
    },

    reset() {
      this.$reset()
    },
  },
})
