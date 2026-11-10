# Code Breakers

Minimal multiplayer scaffold for a "guess the code" game. Same stack as the
`engagement` project, with **live multiplayer** (host + players join by PIN and
connect in real time). Deployed on **Vercel** (free Hobby tier — no Amplify).

The full game (ported from the `UX/` prototype) in a production stack: crack a
secret four-digit code faster than your friends, across devices.

## Stack

- **Vue 3** + **Vite** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Pinia** for all game state and scoring logic
- **Ably** for realtime multiplayer (one channel per room code)
- **lucide-vue-next** for icons
- **Vercel serverless functions** under `api/` (via `@vercel/node`)

## How the multiplayer flow works

The app is a single screen driven by `page` state in the Pinia store (`home` →
`lobby` → `game`), the same flow as the `UX/` prototype. Realtime uses a
**host-authoritative** model over Ably:

1. A player chooses **Create a room** → gets a 6-char code and becomes the
   **host**. The host owns the authoritative `room` object and broadcasts it as
   `room-state` on the Ably channel `game-<code>`.
2. Another player chooses **Join a room**, enters the code + name, connects to
   the same channel, publishes a `join` event, and requests the current state.
3. The host adds the player and rebroadcasts `room-state`; everyone's UI
   updates live. Players send `guess` events; the host scores them (clue
   counts, time + placement points), updates `room`, and rebroadcasts.
4. Presence is used so the host drops players whose tabs disconnect.

All game rules (secret generation, clue scoring, rounds, leaderboard) live in
`src/stores/gameStore.ts`. Realtime transport lives in
`src/composables/useRealtime.ts` with typed events in `src/types/game.ts`.

The `api/game/*` routes are stateless helpers (mint a room code / validate a
join) — live state flows through Ably. Back them with Vercel KV / Redis if you
want server-authoritative rooms.

## Setup

1. Create a free Ably account at https://ably.com and copy an API key.
2. Copy `.env.example` to `.env.local` and fill in `VITE_ABLY_PUBLIC_KEY`.

```bash
npm install
npm run dev          # http://localhost:5173
```

To run the `api/` serverless routes locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## Build

```bash
npm run build        # vue-tsc type-check + vite build → dist/
npm run preview
```

## Deploy to Vercel (free)

1. Push to GitHub/GitLab/Bitbucket.
2. vercel.com → "Add New → Project" → import the repo (auto-detects Vite).
3. Add env vars from `.env.example` in Project Settings.
4. Deploy. Production deploy + per-branch previews on every push.

Routing + API CORS are configured in `vercel.json`.

## Structure

```
api/
  game/create.ts          POST → mints a room code
  game/[pin]/join.ts      POST → validates a join (live join is over Ably)
src/
  App.vue                 the whole game UI (home / lobby / game)
  composables/useRealtime.ts   Ably wrapper (typed events, presence, per room)
  stores/gameStore.ts          Pinia store: room state + all game logic
  types/game.ts                shared types + realtime event union
  style.css                    full game stylesheet
  main.ts
vercel.json               rewrites + API CORS headers
```

## Notes

- `.npmrc` points at the internal Telenor Nexus registry. Vercel's build
  servers can't reach it — drop or override `.npmrc` for the Vercel build.
- The `api/` routes use an in-memory store for demo only; it won't persist
  across serverless invocations. Use Vercel KV / Redis / Firebase for real
  game state. Live presence already works through Ably regardless.
