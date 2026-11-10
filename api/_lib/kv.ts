/**
 * Thin wrapper over Upstash Redis for storing secret codes server-side.
 *
 * Uses @upstash/redis, which reads the same REST credentials Vercel injects
 * when you connect an "Upstash for Redis" store to the project. It supports
 * both the Vercel KV var names (KV_REST_API_URL / KV_REST_API_TOKEN), the
 * native Upstash names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN),
 * and integration-prefixed names like CODE_KV_REST_API_URL. The writable
 * token is always preferred over any *_READ_ONLY_TOKEN.
 *
 * Keys are namespaced per room/round/player and expire via TTL so we never
 * leak storage on abandoned games (free-tier friendly).
 */
import { Redis } from '@upstash/redis';

const CODE_TTL_SECONDS = 60 * 60 * 2; // 2 hours

/**
 * Resolve the Upstash REST URL + token from env, tolerating the various
 * names Vercel integrations use. Depending on how the store is connected
 * the vars may be `KV_REST_API_*`, `UPSTASH_REDIS_REST_*`, or carry an
 * integration prefix such as `STORAGE_KV_REST_API_*`.
 */
function resolveCredentials(): { url?: string; token?: string } {
  const env = process.env;

  // Treat empty-string env vars as absent (Vercel sometimes creates blank
  // placeholder vars like KV_REST_API_URL="" that would otherwise shadow the
  // real CODE_-prefixed values via the ?? operator).
  const val = (key: string): string | undefined => {
    const v = env[key];
    return v && v.trim() !== '' ? v : undefined;
  };

  const pick = (matcher: (key: string) => boolean): string | undefined => {
    const key = Object.keys(env).find((k) => matcher(k) && !!val(k));
    return key ? val(key) : undefined;
  };

  // URL: accept any *_REST_API_URL / *_REDIS_REST_URL (prefix-tolerant).
  const url =
    val('KV_REST_API_URL') ??
    val('UPSTASH_REDIS_REST_URL') ??
    pick((k) => /REST_API_URL$/i.test(k) || /REDIS_REST_URL$/i.test(k));

  // Token: MUST be the writable token. Explicitly exclude READ_ONLY tokens,
  // otherwise SET operations fail with a permissions error.
  const isWritableTokenKey = (k: string): boolean =>
    (/REST_API_TOKEN$/i.test(k) || /REDIS_REST_TOKEN$/i.test(k)) && !/READ_ONLY/i.test(k);

  const token =
    val('KV_REST_API_TOKEN') ?? val('UPSTASH_REDIS_REST_TOKEN') ?? pick(isWritableTokenKey);

  return { url, token };
}

function getClient(): Redis {
  const { url, token } = resolveCredentials();
  if (!url || !token) {
    // List Redis/KV-related var NAMES only (never values) to aid diagnosis.
    const seen = Object.keys(process.env)
      .filter((k) => /KV|REDIS|UPSTASH/i.test(k))
      .sort();
    throw new Error(
      `Redis credentials missing. No REST URL/token found. ` +
        `Redis/KV-related env vars present: [${seen.join(', ') || 'none'}]. ` +
        `Connect an Upstash for Redis store to the project, then REDEPLOY so the ` +
        `env vars are injected into the running deployment.`,
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
