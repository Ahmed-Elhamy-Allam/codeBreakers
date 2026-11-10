<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const game = useGameStore()

// Guard: if the player lands here without starting, send them home.
if (!game.started) {
  router.replace({ name: 'home' })
}

const selected = ref<string | null>(null)
const options = computed(() => game.shuffledOptions)
const snippet = computed(() => game.currentSnippet)

watch(
  () => game.isFinished,
  (finished) => {
    if (finished) router.replace({ name: 'results' })
  },
  { immediate: true },
)

function choose(option: string) {
  if (selected.value) return
  selected.value = option
  // Brief pause so the player sees the correct/incorrect state.
  setTimeout(() => {
    game.answer(option)
    selected.value = null
  }, 650)
}

function stateClass(option: string): string {
  if (!selected.value) return 'border-slate-700 bg-slate-800 hover:border-sky-500 hover:bg-slate-700'
  if (option === snippet.value?.language) return 'border-emerald-500 bg-emerald-500/20'
  if (option === selected.value) return 'border-rose-500 bg-rose-500/20'
  return 'border-slate-700 bg-slate-800 opacity-50'
}
</script>

<template>
  <main v-if="snippet" class="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
    <header class="flex items-center justify-between font-mono text-sm text-slate-400">
      <span>Round {{ game.current + 1 }} / {{ game.totalRounds }}</span>
      <span class="text-sky-400">{{ game.score }} pts</span>
    </header>

    <h2 class="text-center text-2xl font-bold">What language is this?</h2>

    <pre
      class="overflow-x-auto rounded-xl border border-slate-700 bg-black/50 p-5 text-left font-mono text-sm leading-relaxed text-slate-100"
    ><code>{{ snippet.code }}</code></pre>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        v-for="option in options"
        :key="option"
        class="rounded-xl border-2 px-5 py-4 text-left font-semibold transition active:scale-[0.98]"
        :class="stateClass(option)"
        :disabled="!!selected"
        @click="choose(option)"
      >
        {{ option }}
      </button>
    </div>
  </main>
</template>
