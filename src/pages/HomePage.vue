<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const game = useGameStore()

function startGame() {
  game.start()
  router.push({ name: 'play' })
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
    <div class="space-y-3">
      <h1 class="text-5xl font-black tracking-tight sm:text-6xl">
        <span class="text-sky-400">&lt;/&gt;</span> Code Breakers
      </h1>
      <p class="mx-auto max-w-md text-lg text-slate-400">
        Read the snippet, guess the programming language. How many can you crack?
      </p>
    </div>

    <button
      class="rounded-xl bg-sky-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 active:scale-95"
      @click="startGame"
    >
      Start Game
    </button>

    <p class="font-mono text-sm text-slate-500">{{ game.totalRounds || 8 }} rounds · 100 pts each</p>
  </main>
</template>
