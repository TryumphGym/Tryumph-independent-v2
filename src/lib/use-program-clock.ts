import { useCallback, useEffect, useRef, useState } from "react";
/** One monotonic clock per workout step. Variation/media identity is deliberately
 * not a dependency: replacing a demonstration must not restart the workout. */
export function useProgramClock(initialSeconds: number, targetSeconds: number) {
  const [elapsed, setElapsed] = useState(Math.max(0, initialSeconds)),
    [paused, setPaused] = useState(false),
    [resetVersion, setResetVersion] = useState(0);
  const anchor = useRef({ seconds: initialSeconds, at: performance.now() }),
    pausedRef = useRef(false);
  const clamp = useCallback(
    (n: number) =>
      Math.max(0, Math.min(targetSeconds > 0 ? targetSeconds : 18000, n)),
    [targetSeconds],
  );
  const current = useCallback(
    () =>
      clamp(
        anchor.current.seconds +
          (pausedRef.current
            ? 0
            : (performance.now() - anchor.current.at) / 1000),
      ),
    [clamp],
  );
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    const n = current();
    anchor.current = { seconds: n, at: performance.now() };
    pausedRef.current = true;
    setElapsed(n);
    setPaused(true);
  }, [current]);
  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    anchor.current.at = performance.now();
    pausedRef.current = false;
    setPaused(false);
  }, []);
  const reset = useCallback(() => {
    pausedRef.current = true;
    anchor.current = { seconds: 0, at: performance.now() };
    setElapsed(0);
    setPaused(true);
    setResetVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const n = current();
      setElapsed(n);
      if (targetSeconds > 0 && n >= targetSeconds) pause();
    }, 250);
    return () => clearInterval(id);
  }, [paused, current, pause, targetSeconds, resetVersion]);
  return { elapsed, paused, pause, resume, reset, resetVersion, current };
}
export const clockLabel = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, "0")}`;
