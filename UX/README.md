# Codebreakers

A responsive, English-language game UX built with Vue 3, Vite, Tailwind CSS 4 and Lucide icons.

## Run

```
npm install
npm run dev
```

Build with `npm run build`. The static output is in `dist/`.

## Try the flow

Create a room with a nickname. Open a separate new tab on the same origin, choose another nickname, and join with the room code. The host controls duration, round count, and repeated digits. Start a round and select digits with the keypad or keyboard. Enter submits; Backspace clears; arrow keys switch digit slots. Exact-position and misplaced-digit counts appear in private guess history. Solving reveals a trophy, confetti, points and finish position.

The default is three five-minute rounds. Guesses are unlimited. Score is the greater of 100 and the rounded fraction of remaining time multiplied by 1,000, plus finish bonuses of 100, 70, 40 or 10 for places 1–4. Later places have no finish bonus.

## Prototype scope

Room data lives in localStorage and synchronizes between tabs in the same browser profile and origin. This is a frontend UX prototype, not an internet multiplayer backend. Nicknames are not authenticated accounts. The secret is stored client-side for this prototype. Production requires server-authoritative rooms, guesses, time and scoring, host authorization, private per-player responses, reconnection handling and real cross-device communication (for example a Java API).
