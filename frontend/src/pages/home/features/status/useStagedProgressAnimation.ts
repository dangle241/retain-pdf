// Staged progress animation hook (Blueprint §2 features/status/, risk §8.1——easiest
// timing point to break in the whole codebase).
//
// Copied from components/status/job-status-card-progress-animation.js
// createStatusCardProgressAnimation (that file is "dead", on the "to be replaced by
// StatusCard.jsx family" list; js/components/ prohibits import; buildProgressOptions/
// shouldAnimateRenderPageProgress are job-status/ pure VMs, imported as-is).
//
// Iron rule (risk §8.1): displayedProgressByStage and timer must be useRef, not useState——
// animation jumping one page every 120ms using useState would trigger a full component
// re-render every tick, and closures capture stale state values (functional setState updates
// can bypass the stale-closure issue but still cannot avoid per-tick re-render——ref is the
// only solution that simultaneously satisfies "persist across ticks without triggering render").
// The only thing that truly needs to trigger rendering is renderOptions (output via
// separate useState, delivered to ProgressBlock.jsx for rendering).

import { useEffect, useRef, useState } from "react";
import {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "../../composition/external.js";

const TICK_DELAY_MS = 120;

export function useStagedProgressAnimation({ selected, selectedIsCurrent, snapshot, selectedProgress, jobId }) {
  const displayedProgressByStageRef = useRef({});
  const timerRef = useRef(null);
  const [renderOptions, setRenderOptions] = useState(null);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function rememberProgress(stageKey, current, total) {
    displayedProgressByStageRef.current[stageKey] = {
      current: Number.isFinite(current) ? current : null,
      total: Number.isFinite(total) ? total : null,
    };
  }

  // Job switch reset (risk §8.1 accompanying semantics): displayedProgressByStage is
  // "cross-Stage displayed progress memory"; after job switch old task's memory must be
  // cleared, otherwise new task's same-named Stage would reuse old task's displayed
  // progress as animation starting point.
  useEffect(() => {
    clear();
    displayedProgressByStageRef.current = {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    const previous = displayedProgressByStageRef.current[selected];
    const {
      previousCurrent,
      shouldAnimate,
      targetCurrent,
      targetTotal,
    } = shouldAnimateRenderPageProgress({ selected, selectedIsCurrent, snapshot, selectedProgress, previous });

    if (!shouldAnimate) {
      clear();
      rememberProgress(selected, targetCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({ selected, selectedIsCurrent, snapshot, selectedProgress }));
      return undefined;
    }

    clear();
    let displayedCurrent = previousCurrent;
    const tick = () => {
      displayedCurrent = Math.min(targetCurrent, displayedCurrent + 1);
      rememberProgress(selected, displayedCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({
        selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent,
      }));
      if (displayedCurrent < targetCurrent) {
        timerRef.current = setTimeout(tick, TICK_DELAY_MS);
      }
    };
    tick();
    return clear;
    // selected/selectedIsCurrent/snapshot/selectedProgress all come from props-derived values;
    // every time upstream snapshot changes these references naturally change; the dependency
    // array reruns the animation judgment with those changes——
    // equivalent timing to the old world's render({selected,...}) where every snapshot
    // callback was called once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedIsCurrent, snapshot, selectedProgress]);

  useEffect(() => clear, []);

  return renderOptions;
}




