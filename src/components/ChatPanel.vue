<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { TEAM_META } from '@/types/game';
import { sound } from '@/services/SoundService';

const store = useGameStore();

const open = ref(false);
const draft = ref('');
const listRef = ref<HTMLElement | null>(null);

const messages = computed(() => store.chat);

const teamColor: Record<string, string> = {
  cyan: 'neon-text-cyan',
  magenta: 'neon-text-magenta',
  yellow: 'text-neon-yellow',
  green: 'neon-text-green',
};

/** Our own id for chat (real player id if joined, else the stable chat id). */
const myChatId = computed(() => store.localPlayer?.id || store.chatId);

/** Name color: team color in-game, neutral cyan for anonymous chatters. */
function nameClass(teamId?: string): string {
  if (!teamId) return 'text-cyan-400';
  return teamColor[TEAM_META[teamId as keyof typeof TEAM_META]?.color] ?? 'text-cyan-400';
}

function scrollToBottom(): void {
  void nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
  });
}

watch(
  () => store.chat.length,
  () => {
    if (open.value) scrollToBottom();
  },
);

function toggle(): void {
  open.value = !open.value;
  sound.play('click');
  if (open.value) {
    store.clearUnreadChat();
    scrollToBottom();
  }
}

async function send(): Promise<void> {
  const text = draft.value.trim();
  if (!text) return;
  draft.value = '';
  await store.sendChat(text);
  scrollToBottom();
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
</script>

<template>
  <!-- Floating toggle button -->
  <button
    class="fixed bottom-4 left-4 z-[65] flex items-center gap-2 rounded-full border border-neon-cyan bg-cyber-panel/90 px-4 py-3 text-sm font-bold text-neon-cyan shadow-neon-cyan backdrop-blur transition hover:scale-105"
    @click="toggle"
  >
    💬 <span class="hidden sm:inline">CHAT</span>
    <span
      v-if="store.unreadChat > 0 && !open"
      class="flex h-5 min-w-5 items-center justify-center rounded-full bg-neon-magenta px-1 text-xs font-black text-black animate-pulseGlow"
    >
      {{ store.unreadChat > 9 ? '9+' : store.unreadChat }}
    </span>
  </button>

  <!-- Chat drawer -->
  <Transition name="slide">
    <section
      v-if="open"
      class="panel fixed bottom-20 left-4 z-[65] flex h-[60vh] max-h-[460px] w-[90vw] max-w-sm flex-col border-neon-cyan p-0 shadow-neon-cyan"
    >
      <header class="flex items-center justify-between border-b border-cyber-border px-4 py-3">
        <div>
          <h3 class="font-display font-bold neon-text-cyan">💬 Chat</h3>
          <p class="text-[10px] text-cyan-700">
            you're <span class="text-cyan-400">{{ store.chatDisplayName() }}</span>
          </p>
        </div>
        <button class="text-cyan-500 hover:text-neon-red" aria-label="Close chat" @click="toggle">
          ✕
        </button>
      </header>

      <div ref="listRef" class="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <p v-if="messages.length === 0" class="py-8 text-center text-xs italic text-cyan-800">
          Say hi, taunt your rivals, rally your team…
        </p>
        <div
          v-for="m in messages"
          :key="m.id"
          class="text-sm"
          :class="m.playerId === myChatId ? 'text-right' : ''"
        >
          <div
            class="inline-block max-w-[85%] rounded-lg border border-cyber-border bg-cyber-bg/70 px-3 py-2 text-left"
          >
            <div class="mb-0.5 flex items-center gap-2">
              <span class="text-xs font-bold" :class="nameClass(m.teamId)">
                {{ m.playerName }}
                <span v-if="m.anonymous" class="text-cyan-800" title="hasn't joined a room yet">·guest</span>
                <span v-if="m.playerId === myChatId" class="text-cyan-700">(you)</span>
              </span>
              <span class="text-[10px] text-cyan-800">{{ fmtTime(m.ts) }}</span>
            </div>
            <p class="break-words text-gray-200">{{ m.text }}</p>
          </div>
        </div>
      </div>

      <footer class="flex gap-2 border-t border-cyber-border p-3">
        <input
          v-model="draft"
          maxlength="200"
          placeholder="Type a message…"
          class="input-cyber flex-1 py-2 text-sm"
          @keyup.enter="send"
        />
        <button class="btn-primary px-4 py-2 text-sm" :disabled="!draft.trim()" @click="send">
          Send
        </button>
      </footer>
    </section>
  </Transition>
</template>

<style scoped>
.slide-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-leave-active {
  transition: all 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
