<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  LockKeyhole,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Users,
  Clock3,
  Trophy,
  Copy,
  Check,
  LogOut,
  Settings2,
  ShieldCheck,
  RotateCcw,
  Target,
  Zap,
  HelpCircle,
  X,
  Flag,
  Volume2,
  VolumeX,
  KeyRound,
  CheckCheck,
} from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useRealtime } from '@/composables/useRealtime'
import type { GameSettings, Player, RealtimeEvent } from '@/types/game'

const store = useGameStore()
const { room, page, error } = storeToRefs(store)
const { me, isHost, round, remaining, timerText, attempts, solved, finished, ranked } =
  storeToRefs(store)

const tab = ref<'create' | 'join'>('create')
const name = ref(localStorage.getItem('cb-name') || '')
const codeInput = ref('')
const help = ref(false)
const copied = ref(false)
const sound = ref(true)
const selected = ref(0)
const digits = ref<string[]>(['', '', '', ''])
const toast = ref('')

const valid = computed(
  () =>
    digits.value.every((x) => /^\d$/.test(x)) &&
    (room.value?.settings.repeats || new Set(digits.value).size === 4),
)

// ---- realtime wiring -------------------------------------------------------
type Rt = ReturnType<typeof useRealtime>
let rt: Rt | null = null
let ticker: ReturnType<typeof setInterval> | undefined

/** Host broadcasts the authoritative room state to everyone. */
function broadcastState() {
  if (rt && isHost.value && room.value) {
    rt.publish({ type: 'room-state', room: JSON.parse(JSON.stringify(room.value)) })
  }
}

function handleEvent(ev: RealtimeEvent) {
  if (!rt) return
  if (isHost.value) {
    switch (ev.type) {
      case 'join':
        store.hostAddPlayer(ev.player)
        broadcastState()
        break
      case 'leave':
        store.hostRemovePlayer(ev.playerId)
        broadcastState()
        break
      case 'guess': {
        const ok = store.hostScoreGuess(ev.playerId, ev.guess)
        broadcastState()
        void ok
        break
      }
      case 'request-state':
        broadcastState()
        break
    }
  } else {
    // Players simply mirror whatever the host sends.
    if (ev.type === 'room-state') {
      const prevRound = room.value?.round
      store.setRoom(ev.room)
      if (ev.room.round !== prevRound) {
        digits.value = ['', '', '', '']
        selected.value = 0
      }
      if (ev.room.status === 'playing' && page.value === 'lobby') {
        digits.value = ['', '', '', '']
        selected.value = 0
        store.page = 'game'
      }
      if (ev.room.status === 'lobby' && page.value === 'game') {
        store.page = 'lobby'
      }
    }
  }
}

function connect() {
  if (!room.value) return
  rt = useRealtime(room.value.code, store.playerId)
  rt.onMessage(handleEvent)
  rt.enterPresence()
  if (isHost.value) {
    rt.onPresenceLeave((clientId) => {
      store.hostRemovePlayer(clientId)
      broadcastState()
    })
  }
}

// Host rebroadcasts when its own state changes (settings, start, lobby…).
watch(
  () => (isHost.value && room.value ? JSON.stringify(room.value) : ''),
  (next, prev) => {
    if (next && next !== prev) broadcastState()
  },
)

// ---- entry -----------------------------------------------------------------
function enter() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = 'Enter a player name to continue.'
    return
  }
  localStorage.setItem('cb-name', name.value.trim())

  if (tab.value === 'create') {
    store.createRoom(name.value)
    connect()
    return
  }

  // Join flow: connect to the room channel, announce ourselves, and wait for
  // the host to send back the authoritative room state.
  const code = codeInput.value.trim().toUpperCase()
  if (!code) {
    error.value = 'Enter a room code to join.'
    return
  }
  const self: Player = store.buildSelf(name.value)
  // Create a lightweight local room so the UI can render while we sync.
  store.setRoom({
    code,
    host: '',
    players: [self],
    settings: { minutes: 5, rounds: 3, repeats: false },
    round: 1,
    status: 'lobby',
  })
  store.page = 'lobby'
  connect()
  // Announce + ask the host for the current state.
  setTimeout(() => {
    rt?.publish({ type: 'join', player: self })
    rt?.publish({ type: 'request-state', playerId: store.playerId })
  }, 300)
}

// ---- host controls ---------------------------------------------------------
function settings<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
  store.setSetting(key, value)
}
function start(next = false) {
  store.startRound(next)
  digits.value = ['', '', '', '']
  selected.value = 0
  broadcastState()
}
function lobby() {
  store.backToLobby()
  broadcastState()
}

// ---- gameplay --------------------------------------------------------------
function choose(n: number | string) {
  digits.value[selected.value] = String(n)
  if (selected.value < 3) selected.value++
  error.value = ''
}

function guess() {
  if (!valid.value || solved.value || finished.value) return
  const g = digits.value.join('')
  if (isHost.value) {
    const ok = store.hostScoreGuess(store.playerId, g)
    broadcastState()
    if (ok && sound.value) chime()
  } else {
    rt?.publish({ type: 'guess', playerId: store.playerId, guess: g })
    // The host will send back updated state; celebration sound plays on sync.
  }
  digits.value = ['', '', '', '']
  selected.value = 0
}

// Play the chime for non-host players when they newly solve the round.
watch(solved, (now, before) => {
  if (now && !before && sound.value) chime()
})

function keydown(e: KeyboardEvent) {
  if (page.value !== 'game' || solved.value || finished.value || help.value) return
  const target = e.target as HTMLElement
  if (/input|select|textarea/i.test(target.tagName)) return
  if (/^\d$/.test(e.key)) {
    e.preventDefault()
    choose(e.key)
  }
  if (e.key === 'Enter') guess()
  if (e.key === 'Backspace') {
    e.preventDefault()
    if (digits.value[selected.value] === '') selected.value = Math.max(0, selected.value - 1)
    digits.value[selected.value] = ''
  }
  if (e.key === 'ArrowLeft') selected.value = Math.max(0, selected.value - 1)
  if (e.key === 'ArrowRight') selected.value = Math.min(3, selected.value + 1)
}

function chime() {
  try {
    const ctx = new AudioContext()
    ;[523, 659, 784].forEach((hz, i) => {
      const o = ctx.createOscillator()
      const v = ctx.createGain()
      o.connect(v)
      v.connect(ctx.destination)
      o.frequency.value = hz
      v.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.13)
      v.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.4)
      o.start(ctx.currentTime + i * 0.13)
      o.stop(ctx.currentTime + i * 0.13 + 0.4)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    /* no audio */
  }
}

async function copy() {
  if (!room.value) return
  try {
    await navigator.clipboard.writeText(room.value.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    toast.value = 'Room code: ' + room.value.code
    setTimeout(() => (toast.value = ''), 3500)
  }
}

function leave() {
  if (room.value) {
    if (isHost.value) {
      store.hostRemovePlayer(store.playerId)
      broadcastState()
    } else {
      rt?.publish({ type: 'leave', playerId: store.playerId })
    }
  }
  rt?.close()
  rt = null
  store.leaveRoom()
}

onMounted(() => {
  ticker = setInterval(() => {
    store.tick()
    // Host closes out the round on the timer so scores finalize everywhere.
    if (isHost.value && room.value?.status === 'playing' && remaining.value === 0) {
      broadcastState()
    }
  }, 500)
  window.addEventListener('keydown', keydown)
})
onUnmounted(() => {
  if (ticker) clearInterval(ticker)
  window.removeEventListener('keydown', keydown)
  rt?.close()
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a href="#" class="brand" @click.prevent="page === 'home' ? null : (help = true)"
        ><span class="brand-icon"><LockKeyhole :size="21" /></span> CODE<span class="brand-light"
          >BREAKERS</span
        ><span class="beta">BETA</span></a
      >
      <nav>
        <span class="online-dot"></span
        ><span class="desktop-label">A little logic. A lot of competition.</span
        ><button class="icon-button" aria-label="How to play" @click="help = true">
          <HelpCircle :size="20" /></button
        ><button v-if="room" class="icon-button" aria-label="Leave room" @click="leave">
          <LogOut :size="19" /></button
      ></nav>
    </header>
    <main>
      <template v-if="page === 'home'">
        <div class="home-grid">
          <section class="hero">
            <div class="eyebrow"><span></span> THE MULTIPLAYER MIND GAME</div>
            <h1>Four digits.<br />One code.<br /><em>Your move.</em></h1>
            <p class="hero-description">
              Outthink your friends. Follow the clues.<br />Be the first to crack the code.
            </p>
            <div class="hero-stats">
              <span><Users :size="17" /> Up to 12 players</span
              ><span><Clock3 :size="17" /> 5-minute rounds</span>
            </div>
            <div class="code-art" aria-label="A secret four digit code">
              <div class="orb"></div>
              <div class="art-line"><span>ENCRYPTED SIGNAL</span><span class="signal">● LIVE</span></div>
              <div class="art-digits"><div>7</div><div>?</div><div>2</div><div>?</div></div>
              <div class="art-bottom">
                <span><LockKeyhole :size="13" /> ACCESS LOCKED</span
                ><span>•••• / ONE SECRET COMBINATION</span>
              </div>
              <div class="art-sticker"><Zap :size="17" /> THINK FAST. GUESS SMART.</div>
            </div>
          </section>
          <section class="entry-card">
            <div class="card-top">
              <span class="mini-icon"><KeyRound :size="24" /></span
              ><span class="step-label">YOUR NEXT CHALLENGE</span>
            </div>
            <h2>Get in the game.</h2>
            <p>A secret code is waiting for you.</p>
            <div class="tabs">
              <button :class="{ active: tab === 'create' }" @click="tab = 'create';error = ''">
                Create a room</button
              ><button :class="{ active: tab === 'join' }" @click="tab = 'join';error = ''">
                Join a room
              </button>
            </div>
            <form @submit.prevent="enter">
              <label for="name">PLAYER NAME <span>What should we call you?</span></label
              ><input
                id="name"
                v-model="name"
                maxlength="18"
                autocomplete="nickname"
                placeholder="Enter your name"
                required
              />
              <template v-if="tab === 'join'"
                ><label for="roomcode">ROOM CODE</label
                ><input
                  id="roomcode"
                  v-model="codeInput"
                  class="code-input"
                  placeholder="e.g. XK72F9"
                  maxlength="6"
                  required /></template
              ><div v-else class="room-summary">
                <ShieldCheck :size="21" />
                <div>
                  <strong>Your room. Your rules.</strong>
                  <p>Set up the challenge and invite your friends.</p>
                </div>
              </div>
              <p v-if="error" class="error" role="alert">{{ error }}</p>
              <button class="primary full" type="submit">
                {{ tab === 'create' ? 'Create room' : 'Join room' }}<ArrowRight :size="19" />
              </button>
            </form>
            <div class="entry-footer">
              <LockKeyhole :size="13" /> No account needed. Just a nickname.
            </div>
          </section>
        </div>
        <section class="how-strip">
          <div class="how-title">
            <span class="eyebrow">SIMPLE RULES. SHARP MINDS.</span>
            <h3>Easy to learn.<br />Hard to put down.</h3>
          </div>
          <div class="how-item">
            <span class="number">01</span>
            <h4>Make your move</h4>
            <p>Pick four digits and submit your guess.</p>
          </div>
          <div class="how-item">
            <span class="number">02</span>
            <h4>Read the clues</h4>
            <p>Discover which digits belong, and where.</p>
          </div>
          <div class="how-item">
            <span class="number">03</span>
            <h4>Crack it first</h4>
            <p>The quicker you solve it, the more you score.</p>
          </div>
        </section>
      </template>

      <template v-else-if="page === 'lobby' && room">
        <div class="page-heading">
          <div>
            <div class="eyebrow">THE CALM BEFORE THE CODE</div>
            <h1>Assemble your crew<span class="accent">.</span></h1>
            <p>Your next friendly rivalry starts here.</p>
          </div>
          <div class="room-code">
            <span>ROOM CODE</span
            ><button @click="copy">
              {{ room.code }}<Check v-if="copied" :size="18" /><Copy v-else :size="18" />
            </button>
          </div>
        </div>
        <div class="lobby-grid">
          <section class="panel crew-panel">
            <div class="panel-heading">
              <h3><Users :size="19" /> The crew <span class="count">{{ room.players.length }} / 12</span></h3>
              <span class="live-badge"><i></i> LOBBY OPEN</span>
            </div>
            <div class="players">
              <div v-for="(p, i) in room.players" :key="p.id" class="player-tile">
                <span class="avatar" :style="{ '--avatar-hue': i * 53 + 160 + 'deg' }">{{
                  p.name.slice(0, 2).toUpperCase()
                }}</span>
                <div>
                  <strong>{{ p.name }} <small v-if="p.id === store.playerId">(you)</small></strong>
                  <span>{{ p.id === room.host ? 'Room host' : 'Ready to crack it' }}</span>
                </div>
                <span v-if="p.id === room.host" class="host-badge">HOST</span
                ><Check v-else class="accent" :size="18" />
              </div>
              <div
                v-for="n in Math.min(5, 12 - room.players.length)"
                :key="'empty' + n"
                class="empty-player"
              >
                <span class="empty-avatar"><Plus :size="18" /></span
                ><span>Waiting for a codebreaker…</span>
              </div>
            </div>
            <div class="invite-note">
              <Copy :size="18" />
              <div>
                <strong>Great minds play together.</strong>
                <p>Copy the room code and share it with your crew.</p>
              </div>
              <button class="secondary small" @click="copy">
                {{ copied ? 'Copied!' : 'Copy code' }}
              </button>
            </div>
          </section>
          <section class="panel settings-panel">
            <div class="panel-heading">
              <h3><Settings2 :size="19" /> Game settings</h3>
              <span class="muted text-xs">{{ isHost ? 'HOST CONTROLS' : 'HOST MANAGES' }}</span>
            </div>
            <div class="setting">
              <label>Round duration <Clock3 :size="17" /></label>
              <div class="segmented">
                <button
                  v-for="n in [3, 5, 10]"
                  :key="n"
                  :class="{ active: room.settings.minutes === n }"
                  :disabled="!isHost"
                  @click="settings('minutes', n)"
                >
                  {{ n }} min
                </button>
              </div>
            </div>
            <div class="setting">
              <label>Number of rounds <Flag :size="17" /></label>
              <div class="segmented">
                <button
                  v-for="n in [1, 3, 5]"
                  :key="n"
                  :class="{ active: room.settings.rounds === n }"
                  :disabled="!isHost"
                  @click="settings('rounds', n)"
                >
                  {{ n }} {{ n === 1 ? 'round' : 'rounds' }}
                </button>
              </div>
            </div>
            <div class="toggle-setting">
              <div>
                <strong>Repeated digits</strong>
                <p>Allow a digit more than once</p>
              </div>
              <button
                class="toggle"
                :class="{ on: room.settings.repeats }"
                :disabled="!isHost"
                aria-label="Allow repeated digits"
                :aria-pressed="room.settings.repeats"
                @click="settings('repeats', !room.settings.repeats)"
              >
                <span></span>
              </button>
            </div>
            <div class="rules-note">
              <Zap :size="18" />
              <p>
                <strong>Unlimited guesses. Limited time.</strong><br />Faster solves earn more
                points. The first to crack it gets the biggest bonus.
              </p>
            </div>
            <button v-if="isHost" class="primary full" @click="start()">
              Start the challenge <ArrowRight :size="19" />
            </button>
            <div v-else class="waiting-host">Waiting for the host to start…</div>
            <p class="below-button">
              {{
                isHost
                  ? 'Everyone plays at the same time. You’re in control.'
                  : 'Settings update automatically.'
              }}
            </p>
          </section>
        </div>
      </template>

      <template v-else-if="page === 'game' && room">
        <div class="game-heading">
          <div>
            <div class="eyebrow">
              ROOM {{ room.code }} <span class="eyebrow-separator">/</span> ROUND {{ round }} OF
              {{ room.settings.rounds }}
            </div>
            <h1>
              {{
                finished
                  ? 'Round complete.'
                  : solved
                    ? 'Beautifully decoded.'
                    : 'Trust your logic.'
              }}
            </h1>
          </div>
          <div class="game-clock" :class="{ urgent: remaining < 30 }">
            <Clock3 :size="25" />
            <div><span>TIME REMAINING</span><strong>{{ timerText }}</strong></div>
          </div>
        </div>
        <div class="game-grid">
          <div class="play-column">
            <section v-if="solved && me" class="celebration panel">
              <div class="confetti"><i v-for="n in 28" :key="n" :style="{ '--n': n }"></i></div>
              <div class="victory-art">
                <div class="victory-halo"></div>
                <Trophy :size="76" :stroke-width="1.3" /><span class="spark s1">✦</span
                ><span class="spark s2">✧</span><span class="spark s3">✦</span>
              </div>
              <div class="eyebrow">ACCESS GRANTED</div>
              <h2>Code cracked!</h2>
              <p>Four digits. One brilliant codebreaker.</p>
              <div class="solved-code">
                <span v-for="(d, i) in room.secret" :key="i">{{ d }}</span>
              </div>
              <div class="victory-stats">
                <div><strong>+{{ me.solved[round].points }}</strong><span>POINTS EARNED</span></div>
                <div><strong>#{{ me.solved[round].place }}</strong><span>FINISH POSITION</span></div>
                <div><strong>{{ attempts.length }}</strong><span>GUESSES</span></div>
              </div>
              <p class="muted">
                {{
                  finished
                    ? 'See how everyone did below.'
                    : 'Enjoy your victory. The others are still cracking…'
                }}
              </p>
            </section>
            <section v-else-if="!finished" class="panel guess-panel">
              <div class="panel-heading">
                <h3><Target :size="19" /> Your next move</h3>
                <span class="muted text-xs">{{
                  room.settings.repeats ? 'REPEATED DIGITS ALLOWED' : '4 DIFFERENT DIGITS'
                }}</span>
              </div>
              <p class="guess-intro">Every guess gets you closer. Make this one count.</p>
              <div class="digit-inputs">
                <button
                  v-for="(d, i) in digits"
                  :key="i"
                  :class="{ selected: selected === i, filled: d !== '' }"
                  :aria-label="'Digit ' + (i + 1) + (d !== '' ? ': ' + d : ' empty')"
                  @click="selected = i"
                >
                  <span>{{ d === '' ? '—' : d }}</span><small>0{{ i + 1 }}</small>
                </button>
              </div>
              <div class="keypad">
                <button v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]" :key="n" @click="choose(n)">
                  {{ n }}
                </button>
              </div>
              <div class="guess-actions">
                <button
                  class="icon-button reset"
                  aria-label="Clear guess"
                  @click="digits = ['', '', '', ''];selected = 0"
                >
                  <RotateCcw :size="20" /></button
                ><button class="primary" :disabled="!valid" @click="guess">
                  Submit guess <ArrowRight :size="20" />
                </button>
              </div>
              <p class="keyboard-hint">
                {{
                  digits.every((d) => d !== '') && !valid
                    ? 'Use four different digits.'
                    : 'Use your keyboard to type · Enter to submit'
                }}
              </p>
            </section>
            <section v-if="finished" class="panel round-result">
              <h3>
                {{
                  round === room.settings.rounds
                    ? 'The final standings are in.'
                    : 'Ready for the next challenge?'
                }}
              </h3>
              <p>
                The code was <strong class="revealed">{{ room.secret }}</strong
                ><span v-if="!solved"> — a fresh code is a fresh start.</span>
              </p>
              <button
                v-if="isHost && round < room.settings.rounds"
                class="primary"
                @click="start(true)"
              >
                Next round <ArrowRight :size="18" />
              </button>
              <button v-else-if="isHost" class="primary" @click="lobby">
                Back to lobby <ArrowRight :size="18" />
              </button>
              <p v-else class="muted">Waiting for the host…</p>
            </section>
            <section class="panel history-panel">
              <div class="panel-heading">
                <h3>Guess history <span class="count">{{ attempts.length }}</span></h3>
                <span class="muted text-xs">ONLY VISIBLE TO YOU</span>
              </div>
              <div class="legend">
                <span><i class="green-dot"></i> Right digit, right place</span
                ><span><i class="gold-dot"></i> Right digit, wrong place</span>
              </div>
              <div v-if="!attempts.length" class="empty-history">
                <LockKeyhole :size="30" />
                <p>A blank slate. A hidden code.</p>
                <span>Your guesses and clues will appear here.</span>
              </div>
              <div v-else class="history-rows">
                <div
                  class="history-row"
                  v-for="(a, i) in attempts"
                  :key="attempts.length - i"
                >
                  <span class="attempt-number">{{
                    String(attempts.length - i).padStart(2, '0')
                  }}</span>
                  <div class="history-digits">
                    <span v-for="(d, j) in a.guess" :key="j">{{ d }}</span>
                  </div>
                  <div class="clues">
                    <span class="exact"><i></i>{{ a.exact }} <small>right place</small></span
                    ><span class="misplaced"><i></i>{{ a.misplaced }} <small>wrong place</small></span>
                  </div>
                  <CheckCheck v-if="a.exact === 4" :size="18" class="accent" />
                </div>
              </div>
            </section>
          </div>
          <aside>
            <section class="panel leaderboard">
              <div class="panel-heading">
                <h3><Trophy :size="19" /> Leaderboard</h3>
                <span class="live-badge"><i></i> LIVE</span>
              </div>
              <div
                class="rank-row"
                v-for="(p, i) in ranked"
                :key="p.id"
                :class="{ 'is-me': p.id === store.playerId }"
              >
                <span class="rank">{{ String(i + 1).padStart(2, '0') }}</span
                ><span class="avatar small-avatar" :style="{ '--avatar-hue': i * 53 + 160 + 'deg' }">{{
                  p.name.slice(0, 2).toUpperCase()
                }}</span>
                <div class="rank-name">
                  <strong>{{ p.name }} <small v-if="p.id === store.playerId">(you)</small></strong
                  ><span :class="{ accent: p.solved[round] }">{{
                    p.solved[round]
                      ? 'Code cracked ✓'
                      : finished
                        ? 'Round finished'
                        : 'Cracking the code…'
                  }}</span>
                </div>
                <strong class="score">{{ p.score }}</strong>
              </div>
              <div class="leader-footer">
                <Users :size="15" /> {{ room.players.length }}
                {{ room.players.length === 1 ? 'player' : 'players' }} in this challenge
              </div>
            </section>
            <div class="tip-card">
              <span class="mini-icon"><Zap :size="21" /></span>
              <h4>Think in possibilities.</h4>
              <p>A zero is a clue, too. Eliminate digits and compare your previous guesses.</p>
              <button @click="help = true">How the clues work <ArrowUpRight :size="15" /></button>
            </div>
            <button class="sound-button" @click="sound = !sound">
              <Volume2 v-if="sound" :size="17" /><VolumeX v-else :size="17" /> Celebration sound
              {{ sound ? 'on' : 'off' }}
            </button>
          </aside>
        </div>
      </template>
    </main>
    <footer class="site-footer">
      <span><LockKeyhole :size="13" /> BUILT FOR CURIOUS MINDS.</span
      ><span class="prototype-label">Live multiplayer · Share your room code to play together</span
      ><button @click="help = true">How to play <ArrowUpRight :size="13" /></button>
    </footer>
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help = false">
      <section
        class="help-modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <button class="icon-button close" aria-label="Close instructions" @click="help = false">
          <X :size="22" />
        </button>
        <div class="eyebrow">YOUR FIELD GUIDE</div>
        <h2>Crack the code.</h2>
        <p>
          Everyone gets the same secret four-digit code. Your guesses and clues are private.
        </p>
        <div class="help-rule">
          <span class="green-dot"></span>
          <div>
            <strong>Right digit. Right place.</strong>
            <p>The number of digits that exactly match their positions.</p>
          </div>
        </div>
        <div class="help-rule">
          <span class="gold-dot"></span>
          <div>
            <strong>Right digit. Wrong place.</strong>
            <p>These digits are in the code, but need to move.</p>
          </div>
        </div>
        <p>
          For example, if the code is <b>1234</b>, guessing <b>1328</b> gives
          <b>1 right place</b> and <b>2 wrong places</b>.
        </p>
        <p>
          Make unlimited guesses before the timer runs out. Solve faster for up to 1,000 time
          points, plus a finish bonus: 100 for first, 70 for second, 40 for third and 10 for
          fourth.
        </p>
        <div class="rules-note">
          <ShieldCheck :size="20" />
          <p>
            Create a room and share the code so friends can join from any device. Your guesses and
            clues stay private. No password or account is collected.
          </p>
        </div>
        <button class="primary full" @click="help = false">
          Got it. Let’s play. <ArrowRight :size="18" />
        </button>
      </section>
    </div>
  </div>
</template>
