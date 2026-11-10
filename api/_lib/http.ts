/** Small helpers for Vercel Node serverless handlers. */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export function badRequest(res: VercelResponse, msg: string): void {
  sendJson(res, 400, { ok: false, error: msg });
}

export function methodNotAllowed(res: VercelResponse): void {
  sendJson(res, 405, { ok: false, error: 'Method not allowed' });
}

export function serverError(res: VercelResponse, msg: string): void {
  sendJson(res, 500, { ok: false, error: msg });
}

/** Parse + validate JSON body is an object. */
export function readBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T;
  }
  return (req.body ?? {}) as T;
}
