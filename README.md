# Code Breakers

Minimal multiplayer scaffold for a "guess the code" game. Same stack as the
`engagement` project, with **live multiplayer** (host + players join by PIN and
connect in real time). Deployed on **Vercel** (free Hobby tier — no Amplify).

## Stack

- **Vue 3** + **Vite** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Pinia** (state) + **vue-router** (routing)
- **Ably** for realtime multiplayer (one channel per game PIN)
- **Vercel serverless functions** under `api/` (via `@vercel/node`)

## How the multiplayer flow works

1. Host clicks **Host a game** → `POST /api/game/create` returns a 6-digit PIN →
   host lands in the lobby and subscribes to the Ably channel `game-<pin>`.
2. Player clicks **Join a game**, enters the PIN + nickname →
   `POST /api/game/[pin]/join` → player lands in their lobby.
3. The player publishes a `player-joined` event on `game-<pin>`; the host
   receives it live and the player appears in the host's list instantly.

That's the whole realtime skeleton — add your game events (question-start,
submit-answer, show-results, …) by extending `useRealtime` and the store.

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
  game/create.ts          POST → creates a game, returns PIN
  game/[pin]/join.ts      POST → player joins by PIN
src/
  composables/useRealtime.ts   Ably wrapper (publish/subscribe per PIN)
  stores/gameStore.ts          Pinia store (pin, players, me, status)
  pages/
    HomePage.vue          host or join
    HostLobby.vue         live player list
    PlayerJoin.vue        enter PIN + nickname
    PlayerLobby.vue       waiting room, announces join
  router/index.ts
vercel.json               rewrites + API CORS headers
```

## Notes

- `.npmrc` points at the internal Telenor Nexus registry. Vercel's build
  servers can't reach it — drop or override `.npmrc` for the Vercel build.
- The `api/` routes use an in-memory store for demo only; it won't persist
  across serverless invocations. Use Vercel KV / Redis / Firebase for real
  game state. Live presence already works through Ably regardless.
