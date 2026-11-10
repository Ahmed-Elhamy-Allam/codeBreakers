/**
 * POST /api/hint
 * Returns a math-puzzle hint derived from the secret. The hint never reveals
 * exact digits or positions. Point/time cost is enforced client+store side.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, badRequest, methodNotAllowed, serverError, readBody } from './_lib/http.js';
import { buildHint } from './_lib/codegen.js';
import { getSecretCode } from './_lib/kv.js';
import type { HintRequest } from '../src/types/game.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = readBody<Partial<HintRequest>>(req);
  const { roomCode, playerId, round } = body;

  if (!roomCode || !playerId || round == null) {
    return badRequest(res, 'roomCode, playerId and round are required');
  }

  try {
    const stored = await getSecretCode(roomCode, round, playerId);
    if (!stored) return badRequest(res, 'No active code for this player/round');
    sendJson(res, 200, { ok: true, hint: buildHint(stored.digits) });
  } catch (err) {
    serverError(res, `Failed to build hint: ${(err as Error).message}`);
  }
}
