<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { sound } from '@/services/SoundService';
import { useGameStore } from '@/stores/gameStore';
import { initAnalytics, grantConsent } from '@/services/analytics';
import SoundToggle from '@/components/SoundToggle.vue';
import HowToPlayModal from '@/components/HowToPlayModal.vue';
import NotificationCenter from '@/components/NotificationCenter.vue';
import ChatPanel from '@/components/ChatPanel.vue';

const store = useGameStore();
const showHelp = ref(false);

function openHelp(): void {
  sound.init();
  sound.play('click');
  showHelp.value = true;
}

// Unlock audio on first user interaction (browser autoplay policy).
onMounted(() => {
  const unlock = () => {
    sound.init();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Global chat is available everywhere — connect on app start.
  void store.initChat();

  // Microsoft Clarity analytics (session replays, heatmaps, usage insights).
  initAnalytics();
  grantConsent(true);
});
</script>

<template>
  <div class="relative min-h-screen w-full">
    <header class="flex items-center justify-between px-6 py-4">
      <RouterLink to="/" class="font-display text-xl font-black tracking-widest">
        <span class="neon-text-green">&gt;_</span>
        <span class="neon-text-cyan">MAUI</span><span class="neon-text-magenta">POWERUP</span>
      </RouterLink>
      <div class="flex items-center gap-2">
        <button
          class="panel flex items-center gap-2 px-3 py-2 text-sm transition hover:border-neon-cyan"
          title="How to play"
          @click="openHelp"
        >
          <span class="text-lg">📖</span>
          <span class="hidden sm:inline neon-text-cyan">HOW TO PLAY</span>
        </button>
        <SoundToggle />
      </div>
    </header>
    <main class="px-4 pb-12">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <HowToPlayModal :open="showHelp" @close="showHelp = false" />
    <NotificationCenter />
    <ChatPanel />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
