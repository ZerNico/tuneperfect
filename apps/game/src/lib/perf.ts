/**
 * Opt-in timing for the native calls on the game's hot path, used to compare
 * desktop shells. Enabled with `VITE_PERF=1` at build time; otherwise every
 * helper is a pass-through.
 */
const enabled = import.meta.env.VITE_PERF === "1";

const SAMPLE_LIMIT = 10_000;

interface CallStats {
  durations: number[];
  inFlight: number;
  calls: number;
  overlaps: number;
}

const calls = new Map<string, CallStats>();
const frameDeltas: number[] = [];
let lastFrame: number | null = null;
let longTasks = 0;
let longTaskTotalMs = 0;

if (enabled && typeof PerformanceObserver !== "undefined") {
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks++;
        longTaskTotalMs += entry.duration;
      }
    }).observe({ type: "longtask", buffered: false });
  } catch {
    // Long task timing isn't available in every webview.
  }
}

function push(samples: number[], value: number) {
  if (samples.length < SAMPLE_LIMIT) samples.push(value);
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function summarize(samples: number[]) {
  const sorted = samples.toSorted((a, b) => a - b);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    n: sorted.length,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.at(-1) ?? 0),
  };
}

/** Times an async call's round trip and counts calls that start while another is still pending. */
export async function timeCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn();

  let stats = calls.get(name);
  if (!stats) {
    stats = { durations: [], inFlight: 0, calls: 0, overlaps: 0 };
    calls.set(name, stats);
  }

  stats.calls++;
  if (stats.inFlight > 0) stats.overlaps++;
  stats.inFlight++;

  const start = performance.now();
  try {
    return await fn();
  } finally {
    push(stats.durations, performance.now() - start);
    stats.inFlight--;
  }
}

/** Records the time since the previous animation frame while a song is playing. */
export function recordFrame() {
  if (!enabled) return;

  const now = performance.now();
  if (lastFrame !== null) push(frameDeltas, now - lastFrame);
  lastFrame = now;
}

/** Breaks the frame series, so a pause isn't counted as one very long frame. */
export function pauseFrames() {
  lastFrame = null;
}

export function perfReport() {
  const frames = summarize(frameDeltas);
  return {
    calls: Object.fromEntries(
      [...calls].map(([name, stats]) => [
        name,
        { ...summarize(stats.durations), calls: stats.calls, overlaps: stats.overlaps },
      ]),
    ),
    frames: {
      ...frames,
      over20ms: frameDeltas.filter((d) => d > 20).length,
      over33ms: frameDeltas.filter((d) => d > 33).length,
    },
    longTasks: { count: longTasks, totalMs: Math.round(longTaskTotalMs) },
  };
}

export function resetPerf() {
  calls.clear();
  frameDeltas.length = 0;
  lastFrame = null;
  longTasks = 0;
  longTaskTotalMs = 0;
}

/** Logs the report through `console.warn`, which both shells forward to their log output. */
export function logPerfReport() {
  if (!enabled) return;
  console.warn(`[perf] ${JSON.stringify(perfReport())}`);
  resetPerf();
}

if (enabled) {
  (globalThis as { tpPerf?: unknown }).tpPerf = { report: perfReport, reset: resetPerf };
}
