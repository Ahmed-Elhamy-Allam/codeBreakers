<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore';
import { TEAM_META } from '@/types/game';

const store = useGameStore();

const colorText: Record<string, string> = {
  cyan: 'neon-text-cyan',
  magenta: 'neon-text-magenta',
  yellow: 'text-neon-yellow',
  green: 'neon-text-green',
};
</script>

<template>
  <div class="panel p-4">
    <p class="mb-3 text-xs uppercase tracking-widest text-cyan-700">Team Scores</p>
    <ul class="space-y-2">
      <li
        v-for="team in store.sortedTeamsByScore"
        :key="team.id"
        class="flex items-center justify-between rounded border border-cyber-border bg-cyber-bg/60 px-3 py-2"
      >
        <span class="font-display font-bold" :class="colorText[TEAM_META[team.id].color]">
          {{ team.name }}
        </span>
        <span class="font-mono text-lg">{{ team.score }}</span>
      </li>
    </ul>
  </div>
</template>
