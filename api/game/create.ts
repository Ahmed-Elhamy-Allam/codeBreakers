import type { VercelRequest, VercelResponse } from '@vercel/node'

// In-memory store for demo/dev only. In a serverless deployment this does NOT
// persist between invocations — swap for Vercel KV / Redis / Firebase.
const games = new Map<string, unknown>()
export { games }

function generatePin(): string {
  let pin: string
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString()
  } while (games.has(pin))
  return pin
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { hostId } = req.body ?? {}

  const pin = generatePin()
  const game = {
    pin,
    hostId: hostId || `host-${Date.now()}`,
    status: 'lobby',
    players: [],
    createdAt: Date.now(),
  }

  games.set(pin, game)

  // Auto-cleanup after 4 hours
  setTimeout(() => games.delete(pin), 4 * 60 * 60 * 1000)

  return res.status(200).json({ pin, game })
}
