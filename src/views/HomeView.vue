<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/stores/gameStore';
import { DEFAULT_ROOM_CONFIG, TEAM_META, TEAM_ORDER, type TeamId } from '@/types/game';
import { sound } from '@/services/SoundService';
import HowToPlayModal from '@/components/HowToPlayModal.vue';

const router = useRouter();
const store = useGameStore();

const tab = ref<'host' | 'join'>('host');
const name = ref('');
const roomCode = ref('');
const team = ref<TeamId>('alpha');
const busy = ref(false);
const err = ref<string | null>(null);
const showHelp = ref(false);

async function host(): Promise<void> {
  if (!name.value.trim()) {
    err.value = 'Enter a callsign to continue.';
    return;
  }
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
  if (!name.value.trim()) {
    err.value = 'Enter a callsign to continue.';
    return;
  }
  if (roomCode.value.trim().length < 4) {
    err.value = 'Enter a valid room code.';
    return;
  }
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

function submit(): void {
  if (tab.value === 'host') void host();
  else void join();
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- ===================== HERO + ENTRY ===================== -->
    <div class="grid items-center gap-8 pt-4 lg:grid-cols-2">
      <!-- Hero -->
      <section>
        <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-cyber-border bg-cyber-panel/60 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-cyan-500">
          <span class="h-2 w-2 animate-pulseGlow rounded-full bg-neon-green"></span>
          The real-time team code race
        </div>

        <h1 class="font-display text-5xl font-black leading-tight tracking-tight sm:text-6xl">
          <span class="neon-text-cyan">Four digits.</span><br />
          <span class="neon-text-magenta">One code.</span><br />
          <span class="neon-text-green italic">Your team's move.</span>
        </h1>

        <p class="mt-5 max-w-md text-cyan-500">
          Outthink the other teams. Follow the clues, pool your time, and be the first to crack the
          code — then unleash a booster or sabotage to tip the game your way.
        </p>

        <div class="mt-5 flex flex-wrap gap-4 text-sm text-cyan-400">
          <span class="flex items-center gap-2">👥 2–4 teams</span>
          <span class="flex items-center gap-2">⏱ Shared team clock</span>
          <span class="flex items-center gap-2">🎯 3 rounds</span>
          <span class="flex items-center gap-2">🔒 Server-verified codes</span>
        </div>

        <!-- Encrypted signal code-art -->
        <div class="panel mt-8 max-w-md overflow-hidden p-5">
          <div class="relative">
            <div
              class="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-neon-cyan/20 to-transparent"
            ></div>
            <div class="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.3em]">
              <span class="text-cyan-600">Encrypted signal</span>
              <span class="flex items-center gap-1 text-neon-green">● live</span>
            </div>
            <div class="flex justify-center gap-3">
              <div
                v-for="(ch, i) in ['7', '?', '2', '?']"
                :key="i"
                class="flex h-16 w-12 items-center justify-center rounded-lg border-2 font-display text-3xl font-black sm:h-20 sm:w-16 sm:text-4xl"
                :class="
                  ch === '?'
                    ? 'animate-pulseGlow border-cyber-border bg-cyber-bg text-cyan-700'
                    : 'border-neon-green bg-neon-green/10 text-neon-green shadow-neon-green'
                "
              >
                {{ ch }}
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between text-[10px] uppercase tracking-widest text-cyan-700">
              <span>🔒 access locked</span>
              <span>one secret combination</span>
            </div>
            <div
              class="mt-4 inline-flex items-center gap-2 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10 px-3 py-1 text-xs font-bold text-neon-magenta"
            >
              ⚡ think fast. guess smart.
            </div>
          </div>
        </div>
      </section>

      <!-- Entry card -->
      <section class="panel p-6">
        <div class="mb-4 flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg border border-neon-cyan/50 text-xl">🔑</span>
          <div>
            <p class="text-[11px] uppercase tracking-[0.25em] text-cyan-700">Your next challenge</p>
            <h2 class="font-display text-xl font-bold neon-text-green">Get in the game</h2>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-5 grid grid-cols-2 gap-2">
          <button
            class="panel py-2 text-sm font-bold uppercase tracking-wider"
            :class="tab === 'host' ? 'border-neon-green text-neon-green shadow-neon-green' : 'text-cyan-600 opacity-70'"
            @click="tab = 'host'; err = null; sound.play('click')"
          >
            Host a room
          </button>
          <button
            class="panel py-2 text-sm font-bold uppercase tracking-wider"
            :class="tab === 'join' ? 'border-neon-cyan text-neon-cyan shadow-neon-cyan' : 'text-cyan-600 opacity-70'"
            @click="tab = 'join'; err = null; sound.play('click')"
          >
            Join a room
          </button>
        </div>

        <label class="mb-1 block text-xs uppercase text-cyan-600">
          Player callsign <span class="text-cyan-800">— what should we call you?</span>
        </label>
        <input
          v-model="name"
          maxlength="16"
          placeholder="NEO"
          class="input-cyber mb-4 w-full"
          @keyup.enter="submit"
        />

        <template v-if="tab === 'join'">
          <label class="mb-1 block text-xs uppercase text-cyan-600">Room code</label>
          <input
            v-model="roomCode"
            maxlength="5"
            placeholder="X7K2P"
            class="input-cyber mb-4 w-full uppercase tracking-[0.4em]"
            @input="roomCode = roomCode.toUpperCase()"
            @keyup.enter="submit"
          />

          <label class="mb-1 block text-xs uppercase text-cyan-600">Pick a team</label>
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

        <div
          v-else
          class="mb-4 flex items-start gap-3 rounded-lg border border-cyber-border bg-cyber-bg/60 p-3"
        >
          <span class="text-xl">🛡️</span>
          <div>
            <strong class="text-sm text-gray-200">Your room, your rules.</strong>
            <p class="text-xs text-cyan-600">
              Set the mode, time or tries, teams, and difficulty in the lobby — then invite your
              crew.
            </p>
          </div>
        </div>

        <p v-if="err" class="mb-3 text-sm text-neon-red">⚠ {{ err }}</p>

        <button class="btn-green w-full text-lg" :disabled="busy" @click="submit">
          {{ busy ? 'CONNECTING…' : tab === 'host' ? 'Create room →' : 'Join room →' }}
        </button>

        <p class="mt-4 flex items-center justify-center gap-2 text-[11px] text-cyan-700">
          🔒 No account needed. Just a callsign.
        </p>
      </section>
    </div>

    <!-- ===================== HOW IT WORKS ===================== -->
    <section class="mt-14">
      <div class="mb-6 text-center">
        <p class="text-xs uppercase tracking-[0.3em] text-cyan-700">Simple rules. Sharp minds.</p>
        <h3 class="font-display text-3xl font-black">
          Easy to learn. <span class="neon-text-cyan">Hard to put down.</span>
        </h3>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="panel p-6">
          <span class="font-display text-4xl font-black neon-text-magenta">01</span>
          <h4 class="mt-2 text-lg font-bold">Make your move</h4>
          <p class="mt-1 text-sm text-cyan-600">
            Each player gets their own secret code. Type your digits and submit a guess — fast.
          </p>
        </div>
        <div class="panel p-6">
          <span class="font-display text-4xl font-black neon-text-cyan">02</span>
          <h4 class="mt-2 text-lg font-bold">Read the clues</h4>
          <p class="mt-1 text-sm text-cyan-600">
            Green locks a correct digit in place. A yellow count tells you how many are right but
            misplaced.
          </p>
        </div>
        <div class="panel p-6">
          <span class="font-display text-4xl font-black neon-text-green">03</span>
          <h4 class="mt-2 text-lg font-bold">Crack it first</h4>
          <p class="mt-1 text-sm text-cyan-600">
            Solve before your team's pool runs out. Finish first for the biggest score, then fire a
            booster.
          </p>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center gap-3">
        <button class="btn-primary" @click="showHelp = true; sound.play('click')">
          📖 Full walkthrough — how to play
        </button>
        <p class="text-[11px] uppercase tracking-widest text-cyan-800">
          A little logic. A lot of competition.
        </p>
      </div>
    </section>

    <HowToPlayModal :open="showHelp" @close="showHelp = false" />
  </div>
</template>
