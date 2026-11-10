<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/gameStore';
import { DEFAULT_ROOM_CONFIG, TEAM_META, TEAM_ORDER, type TeamId } from '@/types/game';
import { sound } from '@/services/SoundService';

const router = useRouter();
const store = useGameStore();

const mode = ref<'menu' | 'host' | 'join'>('menu');
const name = ref('');
const roomCode = ref('');
const team = ref<TeamId>('alpha');
const busy = ref(false);
const err = ref<string | null>(null);

async function host(): Promise<void> {
  if (!name.value.trim()) return;
  busy.value = true;
  err.value = null;
  try {
    sound.play('click');
    await store.hostRoom(name.value.trim(), { ...DEFAULT_ROOM_CONFIG });
    await router.push('/lobby');
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function join(): Promise<void> {
  if (!name.value.trim() || roomCode.value.trim().length < 4) return;
  busy.value = true;
  err.value = null;
  try {
    sound.play('click');
    await store.joinRoom(name.value.trim(), roomCode.value.trim(), team.value);
    await router.push('/lobby');
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col items-center gap-8 pt-10">
    <div class="text-center">
      <h1 class="font-display text-5xl font-black tracking-widest sm:text-6xl">
        <span class="neon-text-cyan animate-flicker">CODE</span><span class="neon-text-magenta">BREAKERS</span>
      </h1>
      <p class="mt-3 text-sm uppercase tracking-[0.3em] text-cyan-700">
        crack the code // beat the clock // own your team
      </p>
    </div>

    <div v-if="mode === 'menu'" class="flex w-full flex-col gap-4">
      <button class="btn-green text-lg" @click="mode = 'host'; sound.play('click')">
        🎮 Host a Room
      </button>
      <button class="btn-primary text-lg" @click="mode = 'join'; sound.play('click')">
        🔑 Join a Room
      </button>
    </div>

    <div v-else class="panel w-full p-6">
      <h2 class="mb-4 font-display text-xl neon-text-green">
        {{ mode === 'host' ? 'Host Setup' : 'Join Game' }}
      </h2>

      <label class="mb-1 block text-xs uppercase text-cyan-600">Your Callsign</label>
      <input
        v-model="name"
        maxlength="16"
        placeholder="NEO"
        class="input-cyber mb-4 w-full"
        @keyup.enter="mode === 'host' ? host() : join()"
      />

      <template v-if="mode === 'join'">
        <label class="mb-1 block text-xs uppercase text-cyan-600">Room Code</label>
        <input
          v-model="roomCode"
          maxlength="5"
          placeholder="X7K2P"
          class="input-cyber mb-4 w-full uppercase tracking-[0.4em]"
          @input="roomCode = roomCode.toUpperCase()"
        />

        <label class="mb-1 block text-xs uppercase text-cyan-600">Pick a Team</label>
        <div class="mb-4 grid grid-cols-2 gap-2">
          <button
            v-for="tid in TEAM_ORDER.slice(0, 4)"
            :key="tid"
            class="panel px-3 py-2 text-sm transition"
            :class="team === tid ? 'border-neon-cyan shadow-neon-cyan' : 'opacity-60'"
            @click="team = tid; sound.play('click')"
          >
            {{ TEAM_META[tid].name }}
          </button>
        </div>
      </template>

      <p v-if="err" class="mb-3 text-sm text-neon-red">⚠ {{ err }}</p>

      <div class="flex gap-3">
        <button class="btn flex-1 border border-cyber-border" @click="mode = 'menu'; err = null">
          ← Back
        </button>
        <button
          class="btn-green flex-1"
          :disabled="busy"
          @click="mode === 'host' ? host() : join()"
        >
          {{ busy ? 'CONNECTING…' : mode === 'host' ? 'Create →' : 'Join →' }}
        </button>
      </div>
    </div>
  </div>
</template>
