<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { sound } from '@/services/SoundService';

const props = defineProps<{
  length: number;
  lockedPositions: number[];
  /** Locked digit values keyed by position (from solved greens). */
  lockedValues: Record<number, number>;
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', guess: number[]): void;
}>();

const digits = ref<(number | null)[]>([]);
const inputs = ref<HTMLInputElement[]>([]);

function buildDigits(): void {
  const next: (number | null)[] = [];
  for (let i = 0; i < props.length; i++) {
    next[i] = props.lockedValues[i] ?? null;
  }
  digits.value = next;
}
watch(() => [props.length, props.lockedValues], buildDigits, { immediate: true, deep: true });

const isLocked = (i: number): boolean => props.lockedPositions.includes(i);

const complete = computed(() => digits.value.every((d) => d !== null));

/** Index of the first non-locked, empty slot; falls back to first unlocked. */
function firstAvailableIndex(): number {
  for (let i = 0; i < props.length; i++) {
    if (!isLocked(i) && digits.value[i] === null) return i;
  }
  for (let i = 0; i < props.length; i++) {
    if (!isLocked(i)) return i;
  }
  return -1;
}

function focusIndex(i: number): void {
  if (i < 0) return;
  void nextTick(() => inputs.value[i]?.focus());
}

/** Move focus to the first available slot (used after reset / on mount). */
function focusFirstAvailable(): void {
  focusIndex(firstAvailableIndex());
}

function onInput(i: number, ev: Event): void {
  if (isLocked(i)) return;
  const el = ev.target as HTMLInputElement;
  const val = el.value.replace(/[^0-9]/g, '').slice(-1);
  digits.value[i] = val === '' ? null : Number(val);
  el.value = val;
  if (val !== '') {
    sound.play('key');
    focusNextUnlocked(i);
  }
}

function focusNextUnlocked(i: number): void {
  for (let j = i + 1; j < props.length; j++) {
    if (!isLocked(j)) {
      focusIndex(j);
      return;
    }
  }
}

function focusPrevUnlocked(i: number): void {
  for (let j = i - 1; j >= 0; j--) {
    if (!isLocked(j)) {
      focusIndex(j);
      return;
    }
  }
}

function onKeydown(i: number, ev: KeyboardEvent): void {
  switch (ev.key) {
    case 'Backspace':
      if (!digits.value[i]) {
        ev.preventDefault();
        focusPrevUnlocked(i);
      }
      break;
    case 'ArrowLeft':
      ev.preventDefault();
      focusPrevUnlocked(i);
      break;
    case 'ArrowRight':
      ev.preventDefault();
      focusNextUnlocked(i);
      break;
    case 'ArrowUp':
      // Increment the current digit (wraps 9 -> 0).
      if (!isLocked(i)) {
        ev.preventDefault();
        digits.value[i] = ((digits.value[i] ?? -1) + 1 + 10) % 10;
        sound.play('key');
      }
      break;
    case 'ArrowDown':
      if (!isLocked(i)) {
        ev.preventDefault();
        digits.value[i] = ((digits.value[i] ?? 10) - 1 + 10) % 10;
        sound.play('key');
      }
      break;
    case 'Enter':
      if (complete.value) submit();
      break;
  }
}

function submit(): void {
  if (!complete.value || props.disabled) return;
  emit('submit', digits.value.map((d) => d as number));
}

defineExpose({
  reset(): void {
    buildDigits();
    focusFirstAvailable();
  },
  focusFirstAvailable,
});
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="flex justify-center gap-2 sm:gap-3">
      <input
        v-for="(d, i) in digits"
        :key="i"
        ref="inputs"
        :value="d ?? ''"
        inputmode="numeric"
        maxlength="1"
        :disabled="disabled || isLocked(i)"
        class="h-16 w-12 rounded-lg border-2 text-center font-display text-3xl font-black outline-none transition-all sm:h-20 sm:w-16 sm:text-4xl"
        :class="
          isLocked(i)
            ? 'border-neon-green bg-neon-green/10 text-neon-green shadow-neon-green animate-lockIn'
            : 'border-cyber-border bg-cyber-bg text-neon-cyan focus:border-neon-cyan focus:shadow-neon-cyan'
        "
        @input="onInput(i, $event)"
        @keydown="onKeydown(i, $event)"
      />
    </div>
    <button class="btn-green w-full max-w-xs" :disabled="!complete || disabled" @click="submit">
      ⏎ SUBMIT GUESS
    </button>
  </div>
</template>
