<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const game = useGameStore()

if (!game.answers.length) {
  router.replace({ name: 'home' })
}

const correctCount = computed(() => game.answers.filter((a) => a.correct).length)
const total = computed(() => game.answers.length)

function playAgain() {
  game.start()
  router.push({ name: 'play' })
}

function goHome() {
  game.reset()
  router.push({ name: 'home' })
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
    <div class="space-y-2">
      <h1 class="text-4xl font-black">Game Over</h1>
      <p class="text-slate-400">You cracked {{ correctCount }} of {{ total }} snippets.</p>
    </div>

    <div class="font-mono text-6xl font-black text-sky-400">{{ game.score }}</div>

    <div class="flex gap-4">
      <button
        class="rounded-xl bg-sky-500 px-6 py-3 font-bold text-white transition hover:bg-sky-400 active:scale-95"
        @click="playAgain"
      >
        Play Again
      </button>
      <button
        class="rounded-xl border border-slate-600 px-6 py-3 font-bold text-slate-200 transition hover:bg-slate-800 active:scale-95"
        @click="goHome"
      >
        Home
      </button>
    </div>
  </main>
</template>
