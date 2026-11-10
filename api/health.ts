import type { VercelRequest, VercelResponse } from '@vercel/node'

// Simple serverless health check, served at /api/health on Vercel.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: 'ok', service: 'code-breakers', time: new Date().toISOString() })
}
