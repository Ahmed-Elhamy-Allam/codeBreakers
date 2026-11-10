import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Stateless join helper. The live join actually happens over the Ably channel
 * `game-<code>` (the joining player publishes a `join` event and the host adds
 * them), so this route just validates input and echoes a player object in the
 * same shape the client uses. Wire it to a shared store if you later want
 * server-side room validation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pin } = req.query
  const { name } = req.body ?? {}

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const player = {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name).slice(0, 18),
    score: 0,
    attempts: {},
    solved: {},
  }

  return res.status(200).json({ success: true, player, code: pin })
}
