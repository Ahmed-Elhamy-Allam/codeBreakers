<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import type { GameNotification } from '@/types/game';

const store = useGameStore();

const banners = computed(() => store.notifications.filter((n) => n.banner));
const toasts = computed(() => store.notifications.filter((n) => !n.banner));

const colorBorder: Record<GameNotification['color'], string> = {
  green: 'border-neon-green shadow-neon-green',
  red: 'border-neon-red shadow-neon-red',
  magenta: 'border-neon-magenta shadow-neon-magenta',
  cyan: 'border-neon-cyan shadow-neon-cyan',
  yellow: 'border-neon-yellow',
};
const colorText: Record<GameNotification['color'], string> = {
  green: 'neon-text-green',
  red: 'text-neon-red',
  magenta: 'neon-text-magenta',
  cyan: 'neon-text-cyan',
  yellow: 'text-neon-yellow',
};
</script>

<template>
  <!-- Center-screen banners (big, dramatic) -->
  <div class="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-3 px-4">
    <TransitionGroup name="banner">
      <div
        v-for="n in banners"
        :key="n.id"
        class="pointer-events-auto w-full max-w-md rounded-xl border-2 bg-cyber-panel/95 p-4 text-center backdrop-blur"
        :class="colorBorder[n.color]"
      >
        <div class="mb-1 text-4xl animate-float">{{ n.icon }}</div>
        <p class="font-display text-xl font-black tracking-wide" :class="colorText[n.color]">
          {{ n.title }}
        </p>
        <p class="mt-1 text-sm text-gray-200">{{ n.message }}</p>
      </div>
    </TransitionGroup>
  </div>

  <!-- Corner toasts (stacked, subtle) -->
  <div class="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-xs flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="n in toasts"
        :key="n.id"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border bg-cyber-panel/95 p-3 backdrop-blur"
        :class="colorBorder[n.color]"
        @click="store.dismissNotification(n.id)"
      >
        <span class="text-xl">{{ n.icon }}</span>
        <div class="min-w-0">
          <p class="text-sm font-bold" :class="colorText[n.color]">{{ n.title }}</p>
          <p class="truncate text-xs text-gray-300">{{ n.message }}</p>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.banner-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.banner-leave-active {
  transition: all 0.3s ease;
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-30px) scale(0.85);
}
.banner-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>
