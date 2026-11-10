<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { sound } from '@/services/SoundService';

const store = useGameStore();

const isTime = computed(() => store.config.mode === 'time');

const display = computed(() => {
  const r = store.remaining;
  if (isTime.value) {
    const m = Math.floor(r / 60);
    const s = r % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${r}`;
});

const danger = computed(() => (isTime.value ? store.remaining <= 60 : store.remaining <= 2));

// Floating delta label for the local team.
const flash = computed(() => {
  const tid = store.localTeamId;
  return tid ? store.poolFlash[tid] : undefined;
});

const flashText = computed(() => {
  const f = flash.value;
  if (!f) return '';
  const sign = f.delta > 0 ? '+' : '−';
  const mag = Math.abs(f.delta);
  return isTime.value ? `${sign}${mag}s` : `${sign}${mag}`;
});

// Pulse the whole meter briefly when the pool jumps.
const bump = ref(false);
watch(flash, (f) => {
  if (f) {
    bump.value = true;
    window.setTimeout(() => (bump.value = false), 500);
  }
});

// Alarm when crossing the danger threshold.
watch(danger, (isDanger, was) => {
  if (isDanger && !was && store.phase === 'playing') sound.play('alarm');
});
</script>

<template>
  <div
    class="panel relative flex flex-col items-center overflow-visible p-4 transition-transform"
    :class="[
      danger ? 'border-neon-red shadow-neon-red animate-pulseGlow' : '',
      bump ? 'scale-110' : '',
    ]"
  >
    <p class="text-xs uppercase tracking-widest text-cyan-700">
      Your Team {{ isTime ? 'Time' : 'Tries' }}
    </p>
    <p
      class="font-display text-5xl font-black tabular-nums transition-colors"
      :class="danger ? 'text-neon-red' : 'neon-text-green'"
    >
      {{ display }}
    </p>
    <p class="text-[10px] uppercase tracking-widest text-cyan-800">
      pooled across your team only
    </p>

    <!-- Floating delta -->
    <Transition name="float-up">
      <span
        v-if="flash"
        :key="flash.id"
        class="pointer-events-none absolute -top-2 right-2 font-display text-2xl font-black"
        :class="flash.delta > 0 ? 'neon-text-green' : 'text-neon-red'"
      >
        {{ flashText }}
      </span>
    </Transition>
  </div>
</template>

<style scoped>
.float-up-enter-active {
  transition: all 1.4s ease-out;
}
.float-up-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.8);
}
.float-up-enter-to {
  opacity: 0;
  transform: translateY(-40px) scale(1.2);
}
.float-up-leave-active {
  transition: opacity 0.2s;
}
.float-up-leave-to {
  opacity: 0;
}
</style>
