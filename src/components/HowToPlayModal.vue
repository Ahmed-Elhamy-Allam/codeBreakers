<script setup lang="ts">
import { sound } from '@/services/SoundService';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

function close(): void {
  sound.play('click');
  emit('close');
}
</script>

<template>
  <Transition name="pop">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/85 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <section
        class="panel my-auto w-full max-w-3xl border-neon-cyan p-6 shadow-neon-cyan"
        role="dialog"
        aria-modal="true"
        aria-label="How to play MAUIPOWERUP"
      >
        <div class="mb-4 flex items-start justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-cyan-700">Your field guide</p>
            <h2 class="font-display text-3xl font-black neon-text-green">How to play</h2>
          </div>
          <button
            class="rounded-lg border border-cyber-border px-3 py-1 text-cyan-500 hover:border-neon-red hover:text-neon-red"
            aria-label="Close"
            @click="close"
          >
            ✕
          </button>
        </div>

        <p class="mb-5 text-sm text-cyan-500">
          MAUIPOWERUP is a real-time team race. Every player cracks their own secret code for
          their team across <span class="neon-text-magenta">3 rounds</span>. Your team shares one
          pool of time (or tries). Think fast, help your teammates, and sabotage your rivals.
        </p>

        <!-- The flow -->
        <div class="mb-6 grid gap-3 sm:grid-cols-3">
          <div class="panel p-4">
            <span class="font-display text-2xl neon-text-cyan">01</span>
            <h4 class="mt-1 font-bold">Set up a room</h4>
            <p class="text-xs text-cyan-600">
              The host picks Time or Tries mode, the limit, team count (2–4), and difficulty.
              Players join with the room code and pick a team.
            </p>
          </div>
          <div class="panel p-4">
            <span class="font-display text-2xl neon-text-cyan">02</span>
            <h4 class="mt-1 font-bold">Crack your code</h4>
            <p class="text-xs text-cyan-600">
              Everyone cracks their own code at the same time. Type four digits and submit. Read
              the clues to narrow it down.
            </p>
          </div>
          <div class="panel p-4">
            <span class="font-display text-2xl neon-text-cyan">03</span>
            <h4 class="mt-1 font-bold">Win &amp; disrupt</h4>
            <p class="text-xs text-cyan-600">
              Solve first for the biggest score, then pick a booster or destroyer that helps your
              team or hurts the enemy.
            </p>
          </div>
        </div>

        <!-- The clues -->
        <h3 class="mb-3 font-display text-lg neon-text-cyan">Reading the clues</h3>
        <div class="mb-4 space-y-3">
          <div class="flex items-start gap-3">
            <span
              class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-neon-green bg-neon-green/20 font-bold text-neon-green shadow-neon-green"
              >7</span
            >
            <div>
              <strong class="neon-text-green">Right digit, right place</strong>
              <p class="text-xs text-cyan-600">
                Locked in green permanently — you can't change it on later guesses.
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span
              class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-neon-yellow bg-neon-yellow/10 font-bold text-neon-yellow"
              >3</span
            >
            <div>
              <strong class="text-neon-yellow">Right digit, wrong place</strong>
              <p class="text-xs text-cyan-600">
                The digit is in the code, just somewhere else. You'll see a count of how many.
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span
              class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cyber-border bg-cyber-bg font-bold text-gray-500"
              >0</span
            >
            <div>
              <strong class="text-gray-400">Not in the code</strong>
              <p class="text-xs text-cyan-600">Eliminate it and move on.</p>
            </div>
          </div>
        </div>
        <p class="mb-5 rounded-lg border border-cyber-border bg-cyber-bg/60 p-3 text-xs text-cyan-500">
          Example: if the code is <b class="neon-text-green">1234</b> and you guess
          <b class="text-neon-cyan">1328</b>, you get <b class="neon-text-green">1 right place</b>
          (the 1) and <b class="text-neon-yellow">2 wrong place</b> (the 3 and 2).
        </p>

        <!-- Pools & hints -->
        <h3 class="mb-3 font-display text-lg neon-text-cyan">Team pool, hints &amp; scoring</h3>
        <ul class="mb-5 space-y-2 text-sm text-cyan-500">
          <li>
            ⏱ <b>Shared pool:</b> each team shares one pool of time (or tries). It drains as your
            team plays, and leftovers roll into the next round.
          </li>
          <li>
            🧩 <b>Hints</b> cost from <i>your team's</i> pool only and give a math puzzle (sum,
            average, product…) — never the exact digits.
          </li>
          <li>
            🏆 <b>Score</b> rewards solving fast and finishing early. Hints cost you points. Fail
            to solve before the pool runs out and you score 0 that round (but can still cheer).
          </li>
        </ul>

        <!-- Boosters -->
        <h3 class="mb-3 font-display text-lg neon-text-cyan">Boosters &amp; destroyers</h3>
        <div class="mb-6 grid gap-2 sm:grid-cols-2">
          <div class="rounded-lg border border-neon-green/60 p-3">
            <p class="font-bold">⚡ Team Boost</p>
            <p class="text-xs text-cyan-600">+1 min (or +2 tries) to your whole team.</p>
          </div>
          <div class="rounded-lg border border-neon-red/60 p-3">
            <p class="font-bold">💣 Sabotage</p>
            <p class="text-xs text-cyan-600">−1 min (or −2 tries) from every enemy team.</p>
          </div>
          <div class="rounded-lg border border-neon-magenta/60 p-3">
            <p class="font-bold">🔥 Difficulty Up</p>
            <p class="text-xs text-cyan-600">+1 digit to all enemy codes for the round.</p>
          </div>
          <div class="rounded-lg border border-neon-cyan/60 p-3">
            <p class="font-bold">🕊️ Mercy</p>
            <p class="text-xs text-cyan-600">−1 digit from your own or a teammate's code.</p>
          </div>
        </div>

        <button class="btn-green w-full" @click="close">Got it — let's play →</button>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.92);
}
</style>
