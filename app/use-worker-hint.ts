"use client";

import { useEffect, useState } from "react";

// Jobs run in `npm run worker`. If one sits queued this long, the worker probably isn't running,
// and "Queued…" alone would wait forever without saying why.
const WAIT_MS = 30_000;

export function useWorkerHint(queued: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!queued) return;
    const timer = setTimeout(() => setSlow(true), WAIT_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false); // the next wait starts fresh
    };
  }, [queued]);
  return queued && slow;
}

export const WORKER_HINT = "Still waiting. Is the worker running? Start it with npm run worker.";
