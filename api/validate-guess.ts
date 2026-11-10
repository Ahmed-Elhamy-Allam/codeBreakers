/**
 * POST /api/validate-guess
 * Authoritatively scores a guess against the KV-stored secret. The secret
 * never leaves the server; the client only receives per-slot feedback.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendJson, badRequest, methodNotAllowed, serverError, readBody } from './_lib/http.js';
import { scoreGuess } from './_lib/codegen.js';
import { getSecretCode } from './_lib/kv.js';
import type { ValidateGuessRequest } from '../src/types/game.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = readBody<Partial<ValidateGuessRequest>>(req);
  const { roomCode, playerId, round, guess, lockedPositions, attemptNumber } = body;

  if (!roomCode || !playerId || round == null || !Array.isArray(guess)) {
    return badRequest(res, 'roomCode, playerId, round and guess[] are required');
  }

  try {
    const stored = await getSecretCode(roomCode, round, playerId);
    if (!stored) return badRequest(res, 'No active code for this player/round');

    if (guess.length !== stored.digits.length) {
      return badRequest(
        res,
        `Guess length ${guess.length} does not match code length ${stored.digits.length}`,
      );
    }
    if (guess.some((d) => typeof d !== 'number' || d < 0 || d > 9)) {
      return badRequest(res, 'Guess digits must be integers 0-9');
    }

    // lockCorrect is read from the stored code (server-authoritative), not
    // the client, so players can't request position info the host disabled.
    const lockCorrect = stored.lockCorrect !== false;
    const result = scoreGuess(stored.digits, guess, lockedPositions ?? [], lockCorrect);
    result.attemptNumber = attemptNumber ?? 0;

    sendJson(res, 200, { ok: true, result });
  } catch (err) {
    serverError(res, `Failed to validate guess: ${(err as Error).message}`);
  }
}
