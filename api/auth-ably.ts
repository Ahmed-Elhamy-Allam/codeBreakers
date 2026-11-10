/**
 * POST /api/auth-ably
 * Mints a short-lived Ably TokenRequest so the real API key never reaches
 * the browser. Capability is scoped to the game channel for the room.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Ably from 'ably';
import { sendJson, badRequest, methodNotAllowed, serverError, readBody } from './_lib/http.js';

interface Body {
  clientId?: string;
  roomCode?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return serverError(res, 'ABLY_API_KEY not configured');

  const { clientId, roomCode } = readBody<Body>(req);
  if (!clientId) return badRequest(res, 'clientId is required');
  if (!roomCode) return badRequest(res, 'roomCode is required');

  const channel = `cb:room:${roomCode}`;

  try {
    const rest = new Ably.Rest({ key: apiKey });
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId,
      capability: {
        [channel]: ['publish', 'subscribe', 'presence'],
      },
      ttl: 60 * 60 * 1000, // 1 hour
    });
    sendJson(res, 200, tokenRequest);
  } catch (err) {
    serverError(res, `Failed to create Ably token: ${(err as Error).message}`);
  }
}
