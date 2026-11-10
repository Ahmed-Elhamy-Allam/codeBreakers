<script setup lang="ts">
import { ref } from 'vue';
import { sound } from '@/services/SoundService';

const muted = ref(sound.muted);

function toggle(): void {
  sound.init();
  muted.value = sound.toggleMute();
  if (!muted.value) sound.play('click');
}
</script>

<template>
  <button
    class="panel flex items-center gap-2 px-3 py-2 text-sm transition hover:border-neon-cyan"
    :title="muted ? 'Unmute' : 'Mute'"
    @click="toggle"
  >
    <span class="text-lg">{{ muted ? '🔇' : '🔊' }}</span>
    <span class="hidden sm:inline" :class="muted ? 'text-gray-500' : 'neon-text-cyan'">
      {{ muted ? 'MUTED' : 'SOUND' }}
    </span>
  </button>
</template>
