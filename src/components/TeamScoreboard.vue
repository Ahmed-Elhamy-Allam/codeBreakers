<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore';
import { TEAM_META, type PlayerRoundStatus, type TeamId } from '@/types/game';

const store = useGameStore();

const colorText: Record<string, string> = {
  cyan: 'neon-text-cyan',
  magenta: 'neon-text-magenta',
  yellow: 'text-neon-yellow',
  green: 'neon-text-green',
};

/** Round status for a player, or undefined pre-game. */
function statusOf(playerId: string): PlayerRoundStatus | undefined {
  return store.boards[playerId]?.status;
}

const statusBadge: Record<PlayerRoundStatus, { icon: string; cls: string; label: string }> = {
  solved: { icon: '✔', cls: 'text-neon-green', label: 'solved' },
  failed: { icon: '✘', cls: 'text-neon-red', label: 'out' },
  cracking: { icon: '•', cls: 'text-cyan-500 animate-pulseGlow', label: 'cracking' },
};

/** Live remaining pool for a team (seconds or tries), formatted. */
function poolLabel(teamId: TeamId): string {
  const r = store.teamRemaining(teamId);
  if (store.config.mode === 'tries') return `${r} tries`;
  const m = Math.floor(r / 60);
  const s = r % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="panel p-4">
    <p class="mb-3 text-xs uppercase tracking-widest text-cyan-700">Teams &amp; Scores</p>
    <ul class="space-y-3">
      <li
        v-for="team in store.sortedTeamsByScore"
        :key="team.id"
        class="rounded border border-cyber-border bg-cyber-bg/60 p-3"
      >
        <!-- Team header: name + score -->
        <div class="mb-2 flex items-center justify-between">
          <span class="font-display font-bold" :class="colorText[TEAM_META[team.id].color]">
            {{ team.name }}
          </span>
          <div class="flex items-center gap-3">
            <span
              v-if="store.phase === 'playing' || store.phase === 'roundTransition'"
              class="font-mono text-xs text-cyan-600"
              :title="store.config.mode === 'time' ? 'team time left' : 'team tries left'"
            >
              {{ store.config.mode === 'time' ? '⏱' : '🎯' }} {{ poolLabel(team.id) }}
            </span>
            <span class="font-mono text-lg">{{ team.score }}</span>
          </div>
        </div>

        <!-- Players with round status -->
        <ul class="space-y-1">
          <li
            v-for="p in store.playersByTeam(team.id)"
            :key="p.id"
            class="flex items-center justify-between text-sm"
          >
            <span
              class="flex items-center gap-1"
              :class="p.connected ? 'text-gray-200' : 'text-gray-600 line-through'"
            >
              {{ p.name }}
              <span v-if="p.isHost" class="text-xs neon-text-magenta">★</span>
              <span v-if="p.id === store.localPlayerId" class="text-xs text-cyan-700">(you)</span>
            </span>
            <span
              v-if="statusOf(p.id)"
              class="flex items-center gap-1 text-xs"
              :class="statusBadge[statusOf(p.id)!].cls"
            >
              <span>{{ statusBadge[statusOf(p.id)!].icon }}</span>
              <span class="hidden sm:inline">{{ statusBadge[statusOf(p.id)!].label }}</span>
              <span
                v-if="statusOf(p.id) === 'solved' && store.boards[p.id]?.roundScore"
                class="text-cyan-600"
              >
                +{{ store.boards[p.id].roundScore }}
              </span>
            </span>
          </li>
          <li v-if="store.playersByTeam(team.id).length === 0" class="text-xs italic text-cyan-800">
            no players
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
