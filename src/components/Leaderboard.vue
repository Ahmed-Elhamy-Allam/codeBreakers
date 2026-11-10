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

function fmtTime(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

onMounted(() => {
  // Celebrate the winner.
  const end = Date.now() + 1800;
  const frame = (): void => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0 },
      colors: ['#39ff14', '#00f0ff', '#ff00e5'],
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1 },
      colors: ['#39ff14', '#00f0ff', '#ff00e5'],
    });
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
      {{ store.config.rounds }} rounds // the dust settles
    </p>

    <div class="space-y-4">
      <div
        v-for="row in store.leaderboard"
        :key="row.teamId"
        class="panel p-5"
        :class="row.rank === 1 ? 'border-neon-green shadow-neon-green' : ''"
      >
        <!-- Team header -->
        <div class="flex items-center gap-4">
          <span class="text-3xl">{{ medal[row.rank - 1] ?? '•' }}</span>
          <div class="flex-1">
            <p class="font-display text-xl font-bold" :class="colorText[TEAM_META[row.teamId].color]">
              {{ row.teamName }}
            </p>
            <p class="text-xs text-cyan-700">
              ⏱ {{ fmtTime(row.totalTimeConsumed) }} total solve time // 🎯 {{ row.totalTries }} tries
            </p>
          </div>
          <div class="text-right">
            <p class="font-display text-3xl font-black neon-text-cyan">{{ row.score }}</p>
            <p class="text-[10px] uppercase text-cyan-800">points</p>
          </div>
        </div>

        <!-- Per-player breakdown -->
        <div class="mt-4 border-t border-cyber-border pt-3">
          <div
            class="mb-1 hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-2 text-[10px] uppercase tracking-widest text-cyan-800 sm:grid"
          >
            <span>Player</span>
            <span class="text-right">Points</span>
            <span class="text-right">Solved</span>
            <span class="text-right">Time</span>
            <span class="text-right">Tries</span>
          </div>
          <ul class="space-y-1">
            <li
              v-for="p in row.players"
              :key="p.playerId"
              class="grid grid-cols-2 gap-2 rounded bg-cyber-bg/50 px-2 py-2 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
              :class="p.playerId === store.localPlayerId ? 'ring-1 ring-neon-cyan/40' : ''"
            >
              <span class="flex items-center gap-1 text-gray-200">
                {{ p.name }}
                <span v-if="p.isHost" class="text-xs neon-text-magenta">★</span>
                <span v-if="p.playerId === store.localPlayerId" class="text-xs text-cyan-700">(you)</span>
              </span>
              <span class="text-right font-mono neon-text-cyan">
                <span class="text-[10px] uppercase text-cyan-800 sm:hidden">pts </span>{{ p.score }}
              </span>
              <span class="text-right font-mono text-neon-green">
                <span class="text-[10px] uppercase text-cyan-800 sm:hidden">solved </span>
                {{ p.roundsSolved }}/{{ store.config.rounds }}
              </span>
              <span class="text-right font-mono text-cyan-400">
                <span class="text-[10px] uppercase text-cyan-800 sm:hidden">time </span>
                {{ fmtTime(p.totalSolveTime) }}
              </span>
              <span class="text-right font-mono text-cyan-400">
                <span class="text-[10px] uppercase text-cyan-800 sm:hidden">tries </span>{{ p.totalTries }}
                <span v-if="p.hintsUsed > 0" class="text-[10px] text-neon-yellow"> 🧩{{ p.hintsUsed }}</span>
              </span>
            </li>
            <li v-if="row.players.length === 0" class="px-2 py-2 text-xs italic text-cyan-800">
              no players
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <RouterLink to="/" class="btn-primary" @click="store.reset()"> ↺ New Game </RouterLink>
    </div>
  </div>
</template>
