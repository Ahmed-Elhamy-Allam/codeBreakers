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

/** Shared global chat channel available to everyone, even pre-room. */
const GLOBAL_CHAT_CHANNEL = 'cb:global:chat';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return serverError(res, 'ABLY_API_KEY not configured');

  const { clientId, roomCode } = readBody<Body>(req);
  if (!clientId) return badRequest(res, 'clientId is required');

  // Everyone can always use the global chat channel. A room channel is added
  // when a roomCode is supplied (roomCode is optional for pre-room chat).
  const ops: Ably.capabilityOp[] = ['publish', 'subscribe', 'presence'];
  const capability: Record<string, Ably.capabilityOp[]> = {
    [GLOBAL_CHAT_CHANNEL]: ops,
  };
  if (roomCode) {
    capability[`cb:room:${roomCode}`] = ops;
  }

  try {
    const rest = new Ably.Rest({ key: apiKey });
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId,
      capability,
      ttl: 60 * 60 * 1000, // 1 hour
    });
    sendJson(res, 200, tokenRequest);
  } catch (err) {
    serverError(res, `Failed to create Ably token: ${(err as Error).message}`);
  }
}
