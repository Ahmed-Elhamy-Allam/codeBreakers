<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import confetti from 'canvas-confetti';
import { useGameStore } from '@/stores/gameStore';
import PoolMeter from '@/components/PoolMeter.vue';
import TeamScoreboard from '@/components/TeamScoreboard.vue';
import GuessHistory from '@/components/GuessHistory.vue';
import CodeInput from '@/components/CodeInput.vue';
import BoosterModal from '@/components/BoosterModal.vue';
import Leaderboard from '@/components/Leaderboard.vue';
import ChatPanel from '@/components/ChatPanel.vue';

const router = useRouter();
const store = useGameStore();

const shaking = ref(false);
const inputRef = ref<InstanceType<typeof CodeInput> | null>(null);
let timer: number | undefined;

onMounted(() => {
  if (!store.roomCode) {
    void router.push('/');
    return;
  }
  timer = window.setInterval(() => store.tick(), 1000);
});

onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});

const board = computed(() => store.localBoard);

const lockedValues = computed<Record<number, number>>(() => {
  const map: Record<number, number> = {};
  const b = board.value;
  if (!b) return map;
  // Derive locked digit values from the most recent guess at locked positions.
  for (let i = b.history.length - 1; i >= 0; i--) {
    const g = b.history[i];
    g.feedback.forEach((f, pos) => {
      if (f === 'correct' && map[pos] === undefined) map[pos] = g.guess[pos];
    });
  }
  return map;
});

const myStatus = computed(() => board.value?.status ?? 'cracking');

// Celebrate when the local player solves their code.
watch(myStatus, (now, was) => {
  if (now === 'solved' && was !== 'solved') {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#39ff14', '#00f0ff', '#ff00e5', '#faff00'],
    });
  }
});

const canGuess = computed(
  () => store.phase === 'playing' && myStatus.value === 'cracking' && store.remaining > 0,
);

async function onSubmit(guess: number[]): Promise<void> {
  const result = await store.submitGuess(guess);
  if (result && !result.solved) {
    shaking.value = true;
    window.setTimeout(() => (shaking.value = false), 400);
    inputRef.value?.reset();
  }
}

async function onHint(): Promise<void> {
  await store.buyHint();
}

async function advance(): Promise<void> {
  await store.nextRound();
}

const hints = computed(() => board.value?.hintsUsed ?? []);
</script>

<template>
  <!-- Finished -->
  <Leaderboard v-if="store.phase === 'finished'" />

  <!-- Round transition -->
  <div v-else-if="store.phase === 'roundTransition'" class="mx-auto max-w-lg pt-16 text-center">
    <h1 class="font-display text-4xl font-black neon-text-cyan animate-float">
      ROUND {{ store.round }} COMPLETE
    </h1>
    <p class="mt-4 text-cyan-600">
      {{ store.round < store.config.rounds ? 'Boosters applied. Brace for the next round.' : 'Final round done.' }}
    </p>
    <TeamScoreboard class="mx-auto mt-8 max-w-sm" />
    <button v-if="store.isHost" class="btn-green mt-8" @click="advance">
      ▶ Start Round {{ store.round + 1 }}
    </button>
    <p v-else class="mt-8 animate-pulseGlow text-cyan-600">Waiting for host…</p>
  </div>

  <!-- Playing -->
  <div v-else :class="shaking ? 'animate-shake' : ''" class="mx-auto max-w-6xl pt-2">
    <!-- Top status bar -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="panel px-4 py-2">
        <span class="text-xs uppercase text-cyan-700">Round</span>
        <span class="ml-2 font-display text-xl neon-text-magenta">
          {{ store.round }} / {{ store.config.rounds }}
        </span>
      </div>
      <PoolMeter class="min-w-[180px]" />
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left: scoreboard + hints -->
      <aside class="space-y-4 lg:col-span-1">
        <TeamScoreboard />
        <div class="panel p-4">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs uppercase tracking-widest text-cyan-700">Hints</p>
            <button
              class="btn-magenta px-3 py-1 text-xs"
              :disabled="!canGuess"
              @click="onHint"
            >
              Buy (−{{ store.config.hintCost }}{{ store.config.mode === 'time' ? 's' : ' tries' }})
            </button>
          </div>
          <ul class="space-y-1 text-sm text-neon-yellow">
            <li v-for="(h, i) in hints" :key="i">🧩 {{ h }}</li>
            <li v-if="hints.length === 0" class="text-xs italic text-cyan-800">
              Stuck? Buy a math clue. Never reveals exact digits.
            </li>
          </ul>
        </div>
      </aside>

      <!-- Center: the crack -->
      <section class="space-y-5 lg:col-span-2">
        <div class="panel p-6">
          <p class="mb-4 text-center text-xs uppercase tracking-[0.3em] text-cyan-700">
            Crack your {{ board?.codeLength ?? store.config.codeLength }}-digit code
          </p>

          <div v-if="myStatus === 'solved'" class="py-8 text-center">
            <p class="font-display text-3xl font-black neon-text-green animate-float">SOLVED ✔</p>
            <p class="mt-2 text-cyan-600">+{{ board?.roundScore }} points. Cheer your team on!</p>
          </div>
          <div v-else-if="myStatus === 'failed'" class="py-8 text-center">
            <p class="font-display text-3xl font-black text-neon-red">OUT OF {{ store.config.mode === 'time' ? 'TIME' : 'TRIES' }}</p>
            <p class="mt-2 text-cyan-600">0 points this round — assist your teammates!</p>
          </div>
          <CodeInput
            v-else
            ref="inputRef"
            :length="board?.codeLength ?? store.config.codeLength"
            :locked-positions="board?.lockedPositions ?? []"
            :locked-values="lockedValues"
            :disabled="!canGuess"
            @submit="onSubmit"
          />
        </div>

        <GuessHistory :history="board?.history ?? []" />
      </section>
    </div>
  </div>

  <BoosterModal />
  <ChatPanel />
</template>
