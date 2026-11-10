<script setup lang="ts">
import { computed, watch } from 'vue';
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

// Alarm when crossing the danger threshold.
watch(danger, (isDanger, was) => {
  if (isDanger && !was && store.phase === 'playing') sound.play('alarm');
});
</script>

<template>
  <div
    class="panel flex flex-col items-center p-4"
    :class="danger ? 'border-neon-red shadow-neon-red animate-pulseGlow' : ''"
  >
    <p class="text-xs uppercase tracking-widest text-cyan-700">
      {{ isTime ? 'Shared Time' : 'Shared Tries' }}
    </p>
    <p
      class="font-display text-5xl font-black tabular-nums"
      :class="danger ? 'text-neon-red' : 'neon-text-green'"
    >
      {{ display }}
    </p>
    <p class="text-[10px] uppercase tracking-widest text-cyan-800">pooled across your team</p>
  </div>
</template>
