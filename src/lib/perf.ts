/**
 * Timing lines for the Vercel runtime logs.
 *
 * Vercel's request logs record the path, the status and the cache result, and not
 * how long anything took. When the portal was slow in September 2026 there was no
 * number to point at, only a sense that clicks took too long, so the fixes were
 * chosen from reading the code rather than from a stopwatch. These lines are the
 * stopwatch for next time.
 *
 * One line per measured render, prefixed so it can be pulled out of the logs:
 *
 *   vercel logs --environment production --query "[perf]" --expand
 *
 * Deliberately tiny. It records how long named promises took and prints them once;
 * it does not sample, aggregate or ship anywhere.
 */

export interface PerfRun {
  /** Wrap a promise to record how long it took, without changing what it resolves to. */
  time<T>(name: string, work: Promise<T>): Promise<T>
  /** Print one line with the total and every recorded step. */
  done(extra?: Record<string, string | number | boolean>): void
}

export function perfRun(label: string): PerfRun {
  const started = performance.now()
  const steps: Record<string, number> = {}
  return {
    time(name, work) {
      const t0 = performance.now()
      return work.finally(() => { steps[name] = Math.round(performance.now() - t0) })
    },
    done(extra = {}) {
      const parts = Object.entries({ total: Math.round(performance.now() - started), ...steps, ...extra })
        .map(([k, v]) => `${k}=${v}`)
      console.log(`[perf] ${label} ${parts.join(' ')}`)
    },
  }
}
