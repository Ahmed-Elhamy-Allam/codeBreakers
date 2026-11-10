<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const creating = ref(false)

// Host: create a game and go to the lobby.
async function hostGame() {
  creating.value = true
  try {
    const res = await fetch('/api/game/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const { pin } = await res.json()
    router.push({ name: 'host', params: { pin } })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-10 px-6 text-center">
    <h1 class="text-5xl font-black tracking-tight sm:text-6xl">
      <span class="text-sky-400">&lt;/&gt;</span> Code Breakers
    </h1>

    <div class="flex flex-col gap-4 sm:flex-row">
      <button
        class="rounded-xl bg-sky-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-sky-400 active:scale-95 disabled:opacity-50"
        :disabled="creating"
        @click="hostGame"
      >
        {{ creating ? 'Creating…' : 'Host a game' }}
      </button>
      <button
        class="rounded-xl border border-slate-600 px-8 py-4 text-lg font-bold text-slate-200 transition hover:bg-slate-800 active:scale-95"
        @click="router.push({ name: 'join' })"
      >
        Join a game
      </button>
    </div>
  </main>
</template>
