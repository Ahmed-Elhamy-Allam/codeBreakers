<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useRealtime } from '@/composables/useRealtime'

const route = useRoute()
const router = useRouter()
const pin = route.params.pin as string

const game = useGameStore()

// If a player reloads here without having joined, send them back.
if (!game.me) {
  router.replace({ name: 'join' })
}

const { connected, publish } = useRealtime(pin)

onMounted(() => {
  // Announce ourselves to the host and everyone else on the channel.
  if (game.me) {
    publish('player-joined', { player: game.me })
  }
})
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
    <p class="text-sm text-slate-400">You're in</p>
    <p class="text-3xl font-black">{{ game.me?.nickname }}</p>
    <p class="font-mono text-slate-400">PIN {{ pin }}</p>
    <p class="text-xs" :class="connected ? 'text-emerald-400' : 'text-slate-500'">
      {{ connected ? '● live — waiting for host to start' : '○ connecting…' }}
    </p>
  </main>
</template>
