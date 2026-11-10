<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useGameStore, type Player } from '@/stores/gameStore'
import { useRealtime } from '@/composables/useRealtime'

const route = useRoute()
const pin = route.params.pin as string

const game = useGameStore()
const { players } = storeToRefs(game)

const { connected, subscribe } = useRealtime(pin)

onMounted(() => {
  game.setPin(pin)
  game.setStatus('lobby')

  // Live: players broadcast when they join.
  subscribe('player-joined', (data: { player: Player }) => {
    game.addPlayer(data.player)
  })
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-8 px-6 py-12 text-center">
    <div class="space-y-1">
      <p class="text-sm text-slate-400">Game PIN</p>
      <p class="font-mono text-6xl font-black tracking-widest text-sky-400">{{ pin }}</p>
      <p class="text-xs" :class="connected ? 'text-emerald-400' : 'text-slate-500'">
        {{ connected ? '● live' : '○ connecting…' }}
      </p>
    </div>

    <div class="w-full">
      <h2 class="mb-3 text-lg font-bold">Players ({{ players.length }})</h2>
      <ul v-if="players.length" class="flex flex-wrap justify-center gap-2">
        <li
          v-for="p in players"
          :key="p.id"
          class="rounded-full bg-slate-800 px-4 py-2 font-semibold"
        >
          {{ p.nickname }}
        </li>
      </ul>
      <p v-else class="text-slate-500">Waiting for players to join…</p>
    </div>
  </main>
</template>
