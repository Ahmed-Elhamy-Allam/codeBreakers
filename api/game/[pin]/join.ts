import type { VercelRequest, VercelResponse } from '@vercel/node'

// Simplified join handler. In production, look up the game session in a shared
// store (Vercel KV / Redis) using the PIN before accepting the player.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pin } = req.query
  const { nickname } = req.body ?? {}

  if (!nickname) {
    return res.status(400).json({ error: 'Nickname is required' })
  }

  const player = {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: String(nickname).slice(0, 20),
    score: 0,
  }

  return res.status(200).json({ success: true, player, gamePin: pin })
}
