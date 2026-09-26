/**
 * Run `fn`, retrying with a growing delay when it throws. Used for start-up work that talks to the
 * database: on a shared cluster with a low max_connections a transient "no connection slots" error
 * at boot must not be cached forever (a rejected start-up promise otherwise fails every request
 * until the process is restarted).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number; onRetry?: (err: unknown, attempt: number, delayMs: number) => void } = {},
): Promise<T> {
  const { attempts = 12, baseDelayMs = 1000, maxDelayMs = 5000, onRetry } = opts;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts) throw err;
      const delayMs = Math.min(baseDelayMs * attempt, maxDelayMs);
      onRetry?.(err, attempt, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
