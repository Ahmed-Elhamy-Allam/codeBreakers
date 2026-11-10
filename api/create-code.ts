/**
 * POST /api/create-code
 * Generates a secret code for a player for the given round and stores it in
 * KV. Returns only the code LENGTH to the client — never the digits.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, badRequest, methodNotAllowed, serverError, readBody } from './_lib/http.js';
import { generateCode } from './_lib/codegen.js';
import { storeSecretCode } from './_lib/kv.js';
import type { CreateCodeRequest } from '../src/types/game.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = readBody<Partial<CreateCodeRequest>>(req);
  const { roomCode, playerId, codeLength, hardMode, round } = body;

  if (!roomCode || !playerId || round == null) {
    return badRequest(res, 'roomCode, playerId and round are required');
  }
  const len = codeLength ?? 4;
  if (len < 3 || len > 8) return badRequest(res, 'codeLength must be between 3 and 8');

  try {
    const digits = generateCode(len, Boolean(hardMode));
    await storeSecretCode(roomCode, round, playerId, { digits, hardMode: Boolean(hardMode) });
    sendJson(res, 200, { ok: true, codeLength: len });
  } catch (err) {
    serverError(res, `Failed to create code: ${(err as Error).message}`);
  }
}
