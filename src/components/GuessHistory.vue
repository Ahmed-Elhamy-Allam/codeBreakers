<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore';
import type { GuessResult, SlotFeedback } from '@/types/game';

defineProps<{ history: GuessResult[] }>();

const store = useGameStore();

const slotClass: Record<SlotFeedback, string> = {
  correct: 'border-neon-green bg-neon-green/20 text-neon-green shadow-neon-green',
  present: 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow',
  absent: 'border-cyber-border bg-cyber-bg text-gray-500',
};

// In count-only mode, slots carry NO per-position meaning — show a neutral chip.
const neutralSlot = 'border-cyber-border bg-cyber-panel text-cyan-300';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
</script>

<template>
  <div class="panel p-0">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-cyber-border px-4 py-3">
      <p class="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-200">
        Guess history
        <span class="rounded bg-cyber-bg px-2 py-0.5 text-xs text-cyan-500">{{ history.length }}</span>
      </p>
      <span class="text-[10px] uppercase tracking-widest text-cyan-700">Only visible to you</span>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap items-center gap-4 border-b border-cyber-border px-4 py-2 text-xs">
      <template v-if="store.config.lockCorrect">
        <span class="flex items-center gap-1.5 text-gray-300">
          <i class="h-2.5 w-2.5 rounded-full bg-neon-green shadow-neon-green"></i>
          Right digit, right place
        </span>
        <span class="flex items-center gap-1.5 text-gray-300">
          <i class="h-2.5 w-2.5 rounded-full bg-neon-yellow"></i>
          Right digit, wrong place
        </span>
      </template>
      <span v-else class="text-cyan-700">
        Counts only — positions are hidden, so think carefully.
      </span>
    </div>

    <!-- Rows -->
    <div class="max-h-[320px] overflow-y-auto px-2 py-2">
      <TransitionGroup name="row" tag="ul" class="flex flex-col-reverse gap-2">
        <li
          v-for="(g, idx) in history"
          :key="idx"
          class="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 even:bg-cyber-bg/30"
        >
          <span class="font-mono text-xs text-cyan-700">{{ pad(g.attemptNumber) }}</span>

          <!-- Digits -->
          <div class="flex gap-1.5">
            <span
              v-for="(d, i) in g.guess"
              :key="i"
              class="flex h-9 w-9 items-center justify-center rounded-md border font-display text-lg font-bold"
              :class="store.config.lockCorrect ? slotClass[g.feedback[i]] : neutralSlot"
            >
              {{ d }}
            </span>
          </div>

          <!-- Descriptive clues -->
          <div class="ml-auto flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1.5">
              <i class="h-2 w-2 rounded-full bg-neon-green"></i>
              <span class="neon-text-green font-bold">{{ g.correctCount }}</span>
              <span class="text-cyan-600">right place</span>
            </span>
            <span class="flex items-center gap-1.5">
              <i class="h-2 w-2 rounded-full bg-neon-yellow"></i>
              <span class="font-bold text-neon-yellow">{{ g.presentCount }}</span>
              <span class="text-cyan-600">wrong place</span>
            </span>
            <span v-if="g.solved" class="neon-text-green" title="solved">✓✓</span>
          </div>
        </li>
      </TransitionGroup>

      <!-- Empty state -->
      <div v-if="history.length === 0" class="flex flex-col items-center gap-2 py-8 text-center">
        <span class="text-3xl opacity-60">🔒</span>
        <p class="text-sm text-cyan-500">A blank slate. A hidden code.</p>
        <p class="text-xs text-cyan-800">Your guesses and clues will appear here.</p>
      </div>
    </div>
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
