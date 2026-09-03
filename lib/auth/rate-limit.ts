import "server-only";

/**
 * Rate limiter trong bộ nhớ tiến trình — đủ cho một instance server (dev,
 * hoặc production single-instance). Nếu triển khai nhiều instance
 * (horizontal scaling), thay Map này bằng store dùng chung (Redis) nhưng
 * giữ nguyên interface bên dưới.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 phút

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
