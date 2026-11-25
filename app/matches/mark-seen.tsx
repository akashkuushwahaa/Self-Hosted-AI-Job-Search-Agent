"use client";

import { useEffect } from "react";
import { markMatchesSeen } from "./actions";

// Records the visit from the browser, so a prefetch of /matches never counts as seeing it.
// `latest` (the newest score's time) re-marks as scores land while the page is open.
export function MarkSeen({ latest }: { latest: number }) {
  useEffect(() => {
    void markMatchesSeen();
  }, [latest]);
  return null;
}
