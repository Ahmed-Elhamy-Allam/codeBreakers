<script setup lang="ts">
import type { GuessResult, SlotFeedback } from '@/types/game';

defineProps<{ history: GuessResult[] }>();

const slotClass: Record<SlotFeedback, string> = {
  correct: 'border-neon-green bg-neon-green/20 text-neon-green shadow-neon-green',
  present: 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow',
  absent: 'border-cyber-border bg-cyber-bg text-gray-500',
};
</script>

<template>
  <div class="panel max-h-[320px] overflow-y-auto p-3">
    <p class="mb-2 text-xs uppercase tracking-widest text-cyan-700">Feedback Log</p>
    <TransitionGroup name="row" tag="ul" class="flex flex-col-reverse gap-2">
      <li v-for="(g, idx) in history" :key="idx" class="flex items-center gap-2">
        <span class="w-6 text-right text-xs text-cyan-700">#{{ g.attemptNumber }}</span>
        <div class="flex gap-1">
          <span
            v-for="(d, i) in g.guess"
            :key="i"
            class="flex h-8 w-8 items-center justify-center rounded border font-bold"
            :class="slotClass[g.feedback[i]]"
          >
            {{ d }}
          </span>
        </div>
        <div class="ml-auto flex gap-2 text-xs">
          <span class="neon-text-green">✔ {{ g.correctCount }}</span>
          <span class="text-neon-yellow">↔ {{ g.presentCount }}</span>
        </div>
      </li>
    </TransitionGroup>
    <p v-if="history.length === 0" class="py-4 text-center text-xs italic text-cyan-800">
      No guesses yet. Crack it.
    </p>
  </div>
</template>

<style scoped>
.row-enter-active {
  transition: all 0.3s ease;
}
.row-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
