<script setup lang="ts">
import { onMounted } from 'vue';
import confetti from 'canvas-confetti';
import { useGameStore } from '@/stores/gameStore';
import { TEAM_META } from '@/types/game';

const store = useGameStore();

const medal = ['🥇', '🥈', '🥉', '🏅'];

const colorText: Record<string, string> = {
  cyan: 'neon-text-cyan',
  magenta: 'neon-text-magenta',
  yellow: 'text-neon-yellow',
  green: 'neon-text-green',
};

onMounted(() => {
  // Celebrate the winner.
  const end = Date.now() + 1500;
  const frame = (): void => {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors: ['#39ff14', '#00f0ff', '#ff00e5'] });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#39ff14', '#00f0ff', '#ff00e5'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
});
</script>

<template>
  <div class="mx-auto max-w-3xl pt-6">
    <h1 class="mb-2 text-center font-display text-4xl font-black neon-text-green animate-flicker">
      FINAL STANDINGS
    </h1>
    <p class="mb-8 text-center text-sm uppercase tracking-[0.3em] text-cyan-700">
      3 rounds // the dust settles
    </p>

    <div class="space-y-3">
      <div
        v-for="row in store.leaderboard"
        :key="row.teamId"
        class="panel flex items-center gap-4 p-5"
        :class="row.rank === 1 ? 'border-neon-green shadow-neon-green' : ''"
      >
        <span class="text-3xl">{{ medal[row.rank - 1] ?? '•' }}</span>
        <div class="flex-1">
          <p class="font-display text-xl font-bold" :class="colorText[TEAM_META[row.teamId].color]">
            {{ row.teamName }}
          </p>
          <p class="text-xs text-cyan-700">
            ⏱ {{ row.totalTimeConsumed }}s consumed // 🎯 {{ row.totalTries }} tries
          </p>
        </div>
        <div class="text-right">
          <p class="font-display text-3xl font-black neon-text-cyan">{{ row.score }}</p>
          <p class="text-[10px] uppercase text-cyan-800">points</p>
        </div>
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <RouterLink to="/" class="btn-primary" @click="store.reset()">
        ↺ New Game
      </RouterLink>
    </div>
  </div>
</template>
