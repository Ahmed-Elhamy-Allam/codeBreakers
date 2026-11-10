<script setup lang="ts">
import { onMounted } from 'vue';
import { sound } from '@/services/SoundService';
import SoundToggle from '@/components/SoundToggle.vue';

// Unlock audio on first user interaction (browser autoplay policy).
onMounted(() => {
  const unlock = () => {
    sound.init();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
});
</script>

<template>
  <div class="relative min-h-screen w-full">
    <header class="flex items-center justify-between px-6 py-4">
      <RouterLink to="/" class="font-display text-xl font-black tracking-widest">
        <span class="neon-text-green">&gt;_</span>
        <span class="neon-text-cyan">CODE</span><span class="neon-text-magenta">BREAKERS</span>
      </RouterLink>
      <SoundToggle />
    </header>
    <main class="px-4 pb-12">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
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
