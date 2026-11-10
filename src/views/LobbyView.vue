<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/gameStore';
import { TEAM_META, ROUND_OPTIONS, type GameMode, type TeamId, type RoomConfig } from '@/types/game';
import { sound } from '@/services/SoundService';

const router = useRouter();
const store = useGameStore();

onMounted(() => {
  if (!store.roomCode) void router.push('/');
});

// Local editable copy of config (host only).
const cfg = reactive<RoomConfig>({ ...store.config });

watch(
  () => store.config,
  (c) => Object.assign(cfg, c),
  { deep: true },
);

const teamColors: Record<string, string> = {
  cyan: 'border-neon-cyan text-neon-cyan shadow-neon-cyan',
  magenta: 'border-neon-magenta text-neon-magenta shadow-neon-magenta',
  yellow: 'border-neon-yellow text-neon-yellow',
  green: 'border-neon-green text-neon-green shadow-neon-green',
};

const activeTeams = computed(() => store.activeTeams);

async function pushConfig(): Promise<void> {
  await store.updateConfig({ ...cfg });
  sound.play('click');
}

function setMode(m: GameMode): void {
  cfg.mode = m;
  void pushConfig();
}

async function reassign(playerId: string, teamId: TeamId): Promise<void> {
  await store.assignTeam(playerId, teamId);
}

/** The local player picks their own team. */
async function joinTeam(teamId: TeamId): Promise<void> {
  await store.assignTeam(store.localPlayerId, teamId);
}

// Drag & drop
function onDragStart(ev: DragEvent, playerId: string): void {
  ev.dataTransfer?.setData('text/plain', playerId);
}
function onDrop(ev: DragEvent, teamId: TeamId): void {
  const playerId = ev.dataTransfer?.getData('text/plain');
  if (playerId) void reassign(playerId, teamId);
}

async function start(): Promise<void> {
  sound.play('countdown');
  await store.startGame();
  await router.push('/game');
}

watch(
  () => store.phase,
  (p) => {
    if (p === 'playing') void router.push('/game');
  },
);

function copyCode(): void {
  void navigator.clipboard?.writeText(store.roomCode);
  sound.play('click');
}
</script>

<template>
  <div class="mx-auto max-w-5xl pt-4">
    <!-- Room code banner -->
    <div class="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <p class="text-xs uppercase tracking-widest text-cyan-600">Room Code</p>
        <button class="font-display text-4xl font-black tracking-[0.3em] neon-text-green" @click="copyCode">
          {{ store.roomCode }}
        </button>
        <p class="text-xs text-cyan-700">click to copy // share with players</p>
      </div>
      <div class="text-right text-sm text-cyan-500">
        <p>{{ store.playerList.length }} player(s) connected</p>
        <p v-if="store.isHost" class="neon-text-magenta">YOU ARE HOST</p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Host config -->
      <section class="panel p-5 lg:col-span-2">
        <h2 class="mb-4 font-display text-lg neon-text-cyan">Game Config</h2>
        <fieldset :disabled="!store.isHost" class="space-y-5 disabled:opacity-60">
          <!-- Mode -->
          <div>
            <p class="mb-2 text-xs uppercase text-cyan-600">Mode</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                class="panel py-2 text-sm"
                :class="cfg.mode === 'time' ? 'border-neon-cyan shadow-neon-cyan' : 'opacity-60'"
                @click="setMode('time')"
              >
                ⏱ Time-Limited
              </button>
              <button
                class="panel py-2 text-sm"
                :class="cfg.mode === 'tries' ? 'border-neon-cyan shadow-neon-cyan' : 'opacity-60'"
                @click="setMode('tries')"
              >
                🎯 Tries-Limited
              </button>
            </div>
          </div>

          <!-- Limit -->
          <div v-if="cfg.mode === 'time'">
            <label class="mb-1 block text-xs uppercase text-cyan-600">
              Total Shared Minutes (whole game)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              :value="Math.round(cfg.totalTimeSeconds / 60)"
              class="input-cyber w-full"
              @change="cfg.totalTimeSeconds = Math.max(60, (($event.target as HTMLInputElement).valueAsNumber || 10) * 60); pushConfig()"
            />
          </div>
          <div v-else>
            <label class="mb-1 block text-xs uppercase text-cyan-600">
              Total Shared Tries (whole game)
            </label>
            <input
              type="number"
              min="3"
              max="200"
              v-model.number="cfg.totalTries"
              class="input-cyber w-full"
              @change="pushConfig()"
            />
          </div>

          <!-- Hint cost -->
          <div>
            <label class="mb-1 block text-xs uppercase text-cyan-600">
              Hint Cost ({{ cfg.mode === 'time' ? 'seconds' : 'tries' }})
            </label>
            <input
              type="number"
              min="1"
              v-model.number="cfg.hintCost"
              class="input-cyber w-full"
              @change="pushConfig()"
            />
          </div>

          <!-- Teams -->
          <div>
            <label class="mb-1 block text-xs uppercase text-cyan-600">Number of Teams</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="n in [2, 3, 4]"
                :key="n"
                class="panel py-2"
                :class="cfg.teamCount === n ? 'border-neon-cyan shadow-neon-cyan' : 'opacity-60'"
                @click="cfg.teamCount = n as 2 | 3 | 4; pushConfig()"
              >
                {{ n }}
              </button>
            </div>
          </div>

          <!-- Rounds -->
          <div>
            <label class="mb-1 block text-xs uppercase text-cyan-600">Number of Rounds</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="n in ROUND_OPTIONS"
                :key="n"
                class="panel py-2"
                :class="cfg.rounds === n ? 'border-neon-cyan shadow-neon-cyan' : 'opacity-60'"
                @click="cfg.rounds = n; pushConfig()"
              >
                {{ n }} {{ n === 1 ? 'round' : 'rounds' }}
              </button>
            </div>
          </div>

          <!-- Hard mode -->
          <label class="flex items-center justify-between rounded-lg border border-cyber-border p-3">
            <span>
              <span class="neon-text-magenta">Hard Mode</span>
              <span class="block text-xs text-cyan-700">
                Allow repeated digits (easy mode = all unique)
              </span>
            </span>
            <input
              type="checkbox"
              v-model="cfg.hardMode"
              class="h-5 w-5 accent-[#ff00e5]"
              @change="pushConfig()"
            />
          </label>

          <!-- Lock correct digits -->
          <label class="flex items-center justify-between rounded-lg border border-cyber-border p-3">
            <span>
              <span class="neon-text-green">Lock Correct Digits</span>
              <span class="block text-xs text-cyan-700">
                On = correct digits lock green in place. Off = you're only told
                <i>how many</i> are in the right spot (think harder).
              </span>
            </span>
            <input
              type="checkbox"
              v-model="cfg.lockCorrect"
              class="h-5 w-5 accent-[#39ff14]"
              @change="pushConfig()"
            />
          </label>
        </fieldset>
      </section>

      <!-- Teams / players -->
      <section class="lg:col-span-3">
        <h2 class="mb-4 font-display text-lg neon-text-cyan">
          Teams
          <span class="text-xs text-cyan-700">
            // {{ store.isHost ? 'drag players to reassign, or ' : '' }}click a team to join it
          </span>
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="team in activeTeams"
            :key="team.id"
            class="panel min-h-[140px] p-4 transition"
            :class="[
              teamColors[TEAM_META[team.id].color],
              store.localPlayer?.teamId === team.id ? 'ring-2 ring-white/30' : '',
            ]"
            @dragover.prevent
            @drop="onDrop($event, team.id)"
          >
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-display font-bold uppercase tracking-wider">
                {{ team.name }}
                <span class="text-xs opacity-70">({{ store.playersByTeam(team.id).length }})</span>
              </h3>
              <button
                v-if="store.localPlayer?.teamId !== team.id"
                class="rounded border border-current px-2 py-1 text-[11px] font-bold uppercase tracking-wider opacity-90 hover:opacity-100"
                @click="joinTeam(team.id)"
              >
                Join
              </button>
              <span v-else class="text-[11px] uppercase tracking-wider opacity-80">● your team</span>
            </div>
            <ul class="space-y-2">
              <li
                v-for="p in store.playersByTeam(team.id)"
                :key="p.id"
                :draggable="store.isHost"
                class="flex items-center justify-between rounded border border-cyber-border bg-cyber-bg/60 px-3 py-2 text-sm text-gray-200"
                @dragstart="onDragStart($event, p.id)"
              >
                <span>
                  {{ p.name }}
                  <span v-if="p.isHost" class="ml-1 text-xs neon-text-magenta">★</span>
                  <span v-if="p.id === store.localPlayerId" class="ml-1 text-xs text-cyan-600">(you)</span>
                </span>
                <span :class="p.connected ? 'text-neon-green' : 'text-neon-red'">●</span>
              </li>
              <li v-if="store.playersByTeam(team.id).length === 0" class="text-xs italic text-cyan-800">
                empty slot…
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-6">
          <button
            v-if="store.isHost"
            class="btn-green w-full text-lg"
            :disabled="store.playerList.length < 1"
            @click="start"
          >
            🚀 START GAME ({{ store.config.mode === 'time' ? Math.round(store.config.totalTimeSeconds / 60) + ' min' : store.config.totalTries + ' tries' }})
          </button>
          <p v-else class="panel p-4 text-center text-cyan-600 animate-pulseGlow">
            Waiting for host to start…
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
