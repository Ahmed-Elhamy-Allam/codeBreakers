/**
 * POST /api/resize-code
 * Applies the Difficulty-Up (+1 digit) / Mercy (-1 digit) boosters by
 * regenerating the secret at a new length server-side. Existing leading
 * digits are preserved so already-locked positions stay valid.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, badRequest, methodNotAllowed, serverError, readBody } from './_lib/http.js';
import { generateCode } from './_lib/codegen.js';
import { resizeSecretCode } from './_lib/kv.js';

interface Body {
  roomCode?: string;
  playerId?: string;
  round?: number;
  newLength?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const { roomCode, playerId, round, newLength } = readBody<Body>(req);
  if (!roomCode || !playerId || round == null || newLength == null) {
    return badRequest(res, 'roomCode, playerId, round and newLength are required');
  }
  if (newLength < 3 || newLength > 8) return badRequest(res, 'newLength must be 3-8');

  try {
    const updated = await resizeSecretCode(roomCode, round, playerId, newLength, generateCode);
    if (!updated) return badRequest(res, 'No active code for this player/round');
    sendJson(res, 200, { ok: true, codeLength: updated.digits.length });
  } catch (err) {
    serverError(res, `Failed to resize code: ${(err as Error).message}`);
  }
}
