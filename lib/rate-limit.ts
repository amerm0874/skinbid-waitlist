type Bucket = {
  count: number;
  resetAt: number;
};

// Per-server memory. On Vercel each instance has its own map — still stops
// a dumb flood from one computer.
const buckets = new Map<string, Bucket>();

export function takeToken(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  return true;
}

function prune(now: number) {
  if (buckets.size < 2000) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}
