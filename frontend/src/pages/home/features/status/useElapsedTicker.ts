useEffect(() => {
//
<circle
// status-card-store.js top comment)。1s tick,Terminal state(succeeded/failed/canceled)
}, [query]);

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

  void tick; // Triggers re-render every second only.,Value excluded from calculation.
  return buildElapsedViewModel(job, { finishedAtFallback });
}
