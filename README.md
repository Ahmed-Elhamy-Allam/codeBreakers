# MAUIPOWERUP 🟢 `>_`

A high-energy, real-time multiplayer **code-cracking party game**. Each player
cracks their own secret code for their **team**, racing a shared clock (or a
shared pool of tries) across **3 rounds**. Crack it first to earn tactical
**boosters and destroyers**. Built fully in TypeScript.

- **Frontend:** Vue 3 (`<script setup lang="ts">`) + Vite
- **Styling:** Tailwind CSS — dark cyber/terminal theme with neon accents
- **State:** Pinia (strongly typed)
- **Real-time:** Ably (pub/sub + presence) via serverless token auth
- **Backend:** Vercel Serverless Functions (TypeScript) + Upstash Redis
- **Audio:** fully synthesized Web Audio API (no asset files)
- **Anti-cheat:** secret codes live only in Redis + are validated server-side.
  The plaintext code is **never** sent to the browser.

---

## 1. Prerequisites

- Node.js **18+**
- An [Ably](https://ably.com) account (free tier)
- A Vercel account + the Vercel CLI: `npm i -g vercel`
- An **Upstash for Redis** store connected to your Vercel project

## 2. Install

```bash
npm install
```

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local   # (PowerShell: Copy-Item .env.example .env.local)
```

| Variable | Scope | Purpose |
|---|---|---|
| `ABLY_API_KEY` | server only | Mint Ably tokens in `/api/auth-ably`. **Never** prefix with `VITE_`. |
| `KV_REST_API_URL` | server only | Upstash Redis REST URL (auto-injected by Vercel). |
| `KV_REST_API_TOKEN` | server only | Upstash Redis REST token (auto-injected by Vercel). |
| `VITE_ABLY_CLIENT_ID` | client | Optional presence client id. |

> The Redis helper also accepts the native Upstash names
> `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

### Getting the Ably key
1. Sign up at https://ably.com, create an app named `mauipowerup`.
2. Open the app → **API Keys** → copy the root key (`xxxx.yyyy:zzzz`).
3. Put it in `.env.local` as `ABLY_API_KEY=...`.

### Getting the Redis store (same Vercel project as your app)
1. In the Vercel dashboard → your project → **Storage** → **Create Database**.
2. Under **Marketplace Database Providers** expand **Upstash** and pick
   **Upstash for Redis**.
3. Choose the **free** plan + a region, name it `mauipowerup-kv`.
4. **Connect** it to your project for Production + Preview + Development.
5. Sync the injected vars locally:
   ```bash
   vercel link
   vercel env pull .env.local
   ```

## 4. Run locally

Because the game relies on serverless API routes, use the Vercel dev server so
`/api/*` works end-to-end:

```bash
npm run dev:vercel     # runs `vercel dev` → serves Vite + /api functions
```

Pure frontend-only preview (no API) is available via `npm run dev`.

## 5. Build / deploy

```bash
npm run build          # type-checks (vue-tsc) then builds to dist/
vercel deploy          # or push to the connected GitHub repo
```

Add the same env vars to Vercel:

```bash
vercel env add ABLY_API_KEY
# Redis vars are added automatically when you connect the Upstash store.
```

---

## How to play

1. **Host** creates a room and configures it in the lobby:
   - Mode: **Time-Limited** (default 10 shared min) or **Tries-Limited**.
   - Hint cost, number of teams (2–4), and **Hard Mode** (unique digits).
2. Players join with the room code and pick a team. The host can drag players
   between teams.
3. Each round, every player cracks their own code (default 4 digits):
   - 🟩 **green** = right digit, right place → permanently locked.
   - 🟨 **yellow count** = right digit, wrong place.
   - ⬛ absent = not in the code.
4. Crack it to pick a **booster/destroyer**:
   - ⚡ **Team Boost** (+time/tries to your team)
   - 💣 **Sabotage** (−time/tries to enemies)
   - 🔥 **Difficulty Up** (+1 digit to enemy codes)
   - 🕊️ **Mercy** (−1 digit for you or a teammate)
5. Hints cost from the shared pool and only ever give **math puzzles**
   (sum, average, product…), never exact digits.
6. After 3 rounds the **leaderboard** shows each team's score, time consumed,
   and total tries.

---

## Project structure

```
api/                     Vercel serverless (TypeScript)
  auth-ably.ts           mints scoped Ably tokens
  create-code.ts         generates + stores a secret code in Redis
  validate-guess.ts      authoritative Mastermind scoring
  resize-code.ts         Difficulty Up / Mercy digit resizing
  hint.ts                math-puzzle hints
  _lib/                  kv (Redis), http helpers, code gen/scoring
src/
  types/game.ts          all domain models + Ably event contracts
  services/              ably.ts, api.ts, SoundService.ts
  stores/gameStore.ts    the full game loop (Pinia)
  router/                vue-router routes
  views/                 HomeView, LobbyView, GameRoom
  components/            CodeInput, GuessHistory, PoolMeter,
                         TeamScoreboard, BoosterModal, Leaderboard, SoundToggle
```

## Security notes

- The secret code never appears in any client payload, Pinia state, or Ably
  message — only per-slot feedback (`correct`/`present`/`absent`) is broadcast.
- Guesses are validated in `/api/validate-guess` against the Redis-stored code.
- ⚠️ **Rotate your Ably key before going public** if it was ever shared in
  plaintext (e.g. in chat). Delete it in the Ably dashboard, create a fresh one,
  and update `.env.local` + Vercel env.
```
