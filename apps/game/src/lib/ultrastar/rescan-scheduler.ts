export interface RescanSchedulerOptions<R> {
  /** One rescan of the library. */
  run: () => Promise<R>;
  /** Applies results to the library, in the order they came in (several at once after a hold). */
  apply: (results: R[]) => void;
  /** Whether a result left folders that should be looked at again soon (still being copied). */
  isPending: (result: R) => boolean;
  onError: (error: unknown) => void;
  /** How often to rescan on its own. */
  interval: number;
  /** How soon to look again after a pending result; doubles while results stay pending, up to `interval`. */
  retry: number;
  /** Throttled requests (e.g. on every window focus) are dropped this soon after the last rescan. */
  minGap: number;
}

export interface RescanScheduler {
  /** Rescans now, or right after the running rescan, or once the library is let go if it's held. */
  request: (options?: { throttle?: boolean }) => Promise<void>;
  /**
   * Keeps rescans from starting and their results from being applied until the returned release
   * is called (e.g. while a song is sung). A rescan already running finishes, but its result waits.
   */
  hold: () => () => void;
  /** Starts rescanning every `interval` on its own. */
  start: () => void;
  stop: () => void;
}

/** When the library is rescanned: on request, on a timer, and sooner while folders are still settling. */
export function createRescanScheduler<R>(options: RescanSchedulerOptions<R>): RescanScheduler {
  let holds = 0;
  let running: Promise<void> | null = null;
  let again = false;
  let wanted = false;
  let held: R[] = [];
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retry = options.retry;
  let lastRun = Number.NEGATIVE_INFINITY;

  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (started) timer = setTimeout(() => void request(), delay);
  };

  const loop = async () => {
    let pending = false;
    try {
      do {
        again = false;
        if (holds > 0) {
          wanted = true;
          return;
        }
        const result = await options.run();
        lastRun = performance.now();
        pending = options.isPending(result);
        if (holds > 0) held.push(result);
        else options.apply([result]);
      } while (again);
    } catch (error) {
      options.onError(error);
    } finally {
      running = null;
      if (pending) {
        schedule(retry);
        retry = Math.min(retry * 2, options.interval);
      } else {
        retry = options.retry;
        schedule(options.interval);
      }
    }
  };

  const request = (requestOptions?: { throttle?: boolean }): Promise<void> => {
    if (requestOptions?.throttle && performance.now() - lastRun < options.minGap) {
      return running ?? Promise.resolve();
    }
    if (holds > 0) {
      wanted = true;
      return Promise.resolve();
    }
    if (running) {
      again = true;
      return running;
    }
    running = loop();
    return running;
  };

  const hold = () => {
    holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds--;
      if (holds > 0) return;
      if (held.length > 0) {
        const results = held;
        held = [];
        options.apply(results);
      }
      if (wanted) {
        wanted = false;
        void request();
      }
    };
  };

  return {
    request,
    hold,
    start: () => {
      if (started) return;
      started = true;
      schedule(options.interval);
    },
    stop: () => {
      started = false;
      clearTimeout(timer);
    },
  };
}
