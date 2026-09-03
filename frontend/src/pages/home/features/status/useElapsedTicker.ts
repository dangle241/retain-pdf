// Elapsed timer hook (Blueprint §2 features/status/, §3.5).
//
// Driven independently from statusCardStore (elapsed deliberately not placed in store——see
// status-card-store.js top comment). 1s tick, stops at terminal state (succeeded/failed/canceled),
// directly reuses pure functions from job/elapsed-view-model.js.

import { useEffect, useState } from "react";
import {
  buildElapsedViewModel,
  isTerminalStatus,
} from "../../composition/external.js";

export function useElapsedTicker(job, { finishedAtFallback = "" } = {}) {
  const [tick, setTick] = useState(0);

  const status = `${job?.status || ""}`.trim();
  const terminal = isTerminalStatus(status);

  useEffect(() => {
    if (terminal || !job) {
      return undefined;
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [terminal, job?.job_id, status]);

  void tick; // only used to trigger re-render every second; the value itself is not used in calculations
  return buildElapsedViewModel(job, { finishedAtFallback });
}


