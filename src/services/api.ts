/**
 * Typed client for the Vercel serverless endpoints.
 * All secret handling happens behind these calls.
 */
import type {
  CreateCodeResponse,
  ValidateGuessResponse,
  HintResponse,
  GuessResult,
  ApiError,
} from '@/types/game';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T | ApiError;
  if (!res.ok || (json as ApiError).ok === false) {
    throw new Error((json as ApiError).error ?? `Request to ${path} failed`);
  }
  return json as T;
}

export const api = {
  /** Mint an Ably token request (returned object is fed to the Ably SDK). */
  authAbly(clientId: string, roomCode: string): Promise<unknown> {
    return post<unknown>('/api/auth-ably', { clientId, roomCode });
  },

  createCode(args: {
    roomCode: string;
    playerId: string;
    codeLength: number;
    hardMode: boolean;
    round: number;
    lockCorrect: boolean;
  }): Promise<CreateCodeResponse> {
    return post<CreateCodeResponse>('/api/create-code', args);
  },

  async validateGuess(args: {
    roomCode: string;
    playerId: string;
    round: number;
    guess: number[];
    lockedPositions: number[];
    attemptNumber: number;
  }): Promise<GuessResult> {
    const { result } = await post<ValidateGuessResponse>('/api/validate-guess', args);
    return result;
  },

  async hint(args: { roomCode: string; playerId: string; round: number }): Promise<string> {
    const { hint } = await post<HintResponse>('/api/hint', args);
    return hint;
  },

  resizeCode(args: {
    roomCode: string;
    playerId: string;
    round: number;
    newLength: number;
  }): Promise<{ ok: true; codeLength: number }> {
    return post('/api/resize-code', args);
  },
};
