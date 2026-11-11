<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { BOOSTERS, type BoosterType } from '@/types/game';
import { sound } from '@/services/SoundService';

const store = useGameStore();

const chosen = ref<BoosterType | null>(null);
const target = ref<string>('');

const show = computed(() => store.canChooseBooster);

watch(show, (visible) => {
  if (!visible) {
    store.closeBoosterModal();
    chosen.value = null;
    target.value = '';
  }
});

const teammates = computed(() => {
  const me = store.localPlayer;
  if (!me) return [];
  return store.playersByTeam(me.teamId);
});

const boosterList = computed(() => Object.values(BOOSTERS));

const cardColor: Record<BoosterType, string> = {
  teamBoost: 'border-neon-green hover:shadow-neon-green',
  sabotage: 'border-neon-red hover:shadow-neon-red',
  difficultyUp: 'border-neon-magenta hover:shadow-neon-magenta',
  mercy: 'border-neon-cyan hover:shadow-neon-cyan',
};

function select(type: BoosterType): void {
  chosen.value = type;
  sound.play('click');
  if (type !== 'mercy') void confirm();
}

async function confirm(): Promise<void> {
  if (!chosen.value) return;
  await store.chooseBooster(chosen.value, chosen.value === 'mercy' ? target.value || undefined : undefined);
  chosen.value = null;
  target.value = '';
}
</script>

<template>
  <Transition name="pop">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/80 p-4 backdrop-blur-sm"
    >
      <div class="panel my-auto w-full max-w-2xl border-neon-green p-6 shadow-neon-green">
        <h2 class="mb-1 text-center font-display text-2xl font-black neon-text-green">
          CODE CRACKED! 🎉
        </h2>
        <p class="mb-5 text-center text-sm text-cyan-600">
          Choose your tactical modifier
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="b in boosterList"
            :key="b.type"
            class="panel flex flex-col items-start gap-1 p-4 text-left transition-all"
            :class="[cardColor[b.type], chosen === b.type ? 'ring-2 ring-white/40' : '']"
            @click="select(b.type)"
          >
            <span class="text-2xl">{{ b.icon }}</span>
            <span class="font-display font-bold">{{ b.label }}</span>
            <span class="text-xs text-cyan-500">{{ b.description }}</span>
          </button>
        </div>

        <!-- Mercy target selection -->
        <div v-if="chosen === 'mercy'" class="mt-4">
          <label class="mb-1 block text-xs uppercase text-cyan-600">
            Remove a digit from (teammate or yourself)
          </label>
          <select v-model="target" class="input-cyber w-full">
            <option value="">Yourself</option>
            <option v-for="m in teammates" :key="m.id" :value="m.id">
              {{ m.name }}{{ m.id === store.localPlayerId ? ' (you)' : '' }}
            </option>
          </select>
          <button class="btn-primary mt-3 w-full" @click="confirm">Apply Mercy →</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
</style>
