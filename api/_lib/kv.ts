/**
 * Thin wrapper over Upstash Redis for storing secret codes server-side.
 *
 * Uses @upstash/redis, which reads the same REST credentials Vercel injects
 * when you connect an "Upstash for Redis" store to the project. It supports
 * both the Vercel KV var names (KV_REST_API_URL / KV_REST_API_TOKEN) and the
 * native Upstash names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
 *
 * Keys are namespaced per room/round/player and expire via TTL so we never
 * leak storage on abandoned games (free-tier friendly).
 */
import { Redis } from '@upstash/redis';

const CODE_TTL_SECONDS = 60 * 60 * 2; // 2 hours

function getClient(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Redis credentials missing. Connect an Upstash for Redis store to the project and run `vercel env pull .env.local`.',
    );
  }
  return new Redis({ url, token });
}

function codeKey(roomCode: string, round: number, playerId: string): string {
  return `cb:code:${roomCode}:${round}:${playerId}`;
}

export interface StoredCode {
  digits: number[];
  hardMode: boolean;
}

export async function storeSecretCode(
  roomCode: string,
  round: number,
  playerId: string,
  code: StoredCode,
): Promise<void> {
  const redis = getClient();
  await redis.set(codeKey(roomCode, round, playerId), JSON.stringify(code), {
    ex: CODE_TTL_SECONDS,
  });
}

export async function getSecretCode(
  roomCode: string,
  round: number,
  playerId: string,
): Promise<StoredCode | null> {
  const redis = getClient();
  const raw = await redis.get<string | StoredCode>(codeKey(roomCode, round, playerId));
  if (!raw) return null;
  // @upstash/redis may auto-deserialize JSON; handle both shapes.
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as StoredCode;
    } catch {
      return null;
    }
  }
  return raw;
}

/** Mutate the stored code length in place (Difficulty Up / Mercy boosters). */
export async function resizeSecretCode(
  roomCode: string,
  round: number,
  playerId: string,
  newLength: number,
  generator: (len: number, hardMode: boolean, existing: number[]) => number[],
): Promise<StoredCode | null> {
  const existing = await getSecretCode(roomCode, round, playerId);
  if (!existing) return null;
  const digits = generator(newLength, existing.hardMode, existing.digits);
  const updated: StoredCode = { digits, hardMode: existing.hardMode };
  await storeSecretCode(roomCode, round, playerId, updated);
  return updated;
}
