/**
 * Simple in-memory rate limit for shop checkout and redeem.
 * Serverless: per-instance, so not global. Use for basic abuse prevention.
 */

const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = 15;

const store = new Map<string, { count: number; resetAt: number }>();

function getKey(identifier: string): string {
  return identifier;
}

function cleanup() {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (v.resetAt < now) store.delete(key);
  }
}

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  cleanup();
  const key = getKey(identifier);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxPerWindow - 1 };
  }
  if (entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxPerWindow - 1 };
  }
  entry.count += 1;
  const remaining = Math.max(0, maxPerWindow - entry.count);
  return {
    allowed: entry.count <= maxPerWindow,
    remaining,
  };
}

export function getIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}
