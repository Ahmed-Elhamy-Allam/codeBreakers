# Code Breakers

A "guess the code" game — a snippet is shown and you pick which programming
language it's written in. Built with the same stack as the `engagement`
project and deployed on **Vercel** (free Hobby tier).

## Stack

- **Vue 3** + **Vite** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Pinia** for state, **vue-router** for routing
- **Vercel serverless functions** under `api/` (via `@vercel/node`)

## Local development

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

To run the serverless `api/` routes locally too, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

## Build

```bash
npm run build      # type-checks with vue-tsc, then builds to dist/
npm run preview    # preview the production build
```

## Deploy to Vercel (free)

This project needs **no Amplify** — Vercel's free Hobby tier hosts both the
static frontend and the `api/` serverless functions.

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Go to https://vercel.com, "Add New → Project", and import the repo.
3. Vercel auto-detects Vite. Defaults are correct:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add any environment variables (see `.env.example`) in Project Settings.
5. Deploy. Every push gives you a production deploy plus per-branch previews.

Routing and API CORS are configured in `vercel.json`.

## Project structure

```
api/              Vercel serverless functions (e.g. /api/health)
src/
  data/           Code snippets / game rounds
  pages/          Home, Play, Results
  router/         vue-router config
  stores/         Pinia game store
vercel.json       Rewrites + API CORS headers
```
