import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Issues a fresh room code. Room state itself lives with the host client and is
 * broadcast to players over the Ably channel `game-<code>`, so this endpoint is
 * stateless — it just mints a code in the same 6-char alphanumeric format the
 * client uses.
 *
 * Kept as a serverless route so the code can later be reserved in a shared
 * store (Vercel KV / Redis) if you want server-authoritative rooms.
 */
function generateCode(): string {
  // Matches the client format: 6 uppercase base36 characters, e.g. "XK72F9".
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = generateCode()
  return res.status(200).json({ code, pin: code })
}
