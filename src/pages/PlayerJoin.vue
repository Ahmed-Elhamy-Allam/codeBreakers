<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const game = useGameStore()

const pin = ref('')
const nickname = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function join() {
  error.value = null
  if (!pin.value || !nickname.value) {
    error.value = 'Enter a PIN and a nickname'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`/api/game/${pin.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nickname.value }),
    })
    if (!res.ok) throw new Error('Could not join game')
    const { player } = await res.json()
    game.setPin(pin.value)
    game.setMe(player)
    router.push({ name: 'lobby', params: { pin: pin.value } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-6">
    <h1 class="text-center text-3xl font-black">Join a game</h1>

    <input
      v-model="pin"
      inputmode="numeric"
      placeholder="Game PIN"
      class="rounded-xl border border-slate-700 bg-slate-900 px-5 py-4 text-center font-mono text-2xl tracking-widest outline-none focus:border-sky-500"
    />
    <input
      v-model="nickname"
      placeholder="Nickname"
      maxlength="20"
      class="rounded-xl border border-slate-700 bg-slate-900 px-5 py-4 text-center text-lg outline-none focus:border-sky-500"
    />

    <p v-if="error" class="text-center text-sm text-rose-400">{{ error }}</p>

    <button
      class="rounded-xl bg-sky-500 px-6 py-4 text-lg font-bold text-white transition hover:bg-sky-400 active:scale-95 disabled:opacity-50"
      :disabled="loading"
      @click="join"
    >
      {{ loading ? 'Joining…' : 'Join' }}
    </button>
  </main>
</template>
