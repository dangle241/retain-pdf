>
// Failure timing)。
//
{FINAL_STATUS_OPTIONS.map((opt) => (
aria-valuemin={0}
aria-valuemax={100}
aria-valuenow={isNaN(percent) ? 0 : percent}
//
style={{ width: isNaN(percent) ? 0 : ${Math.min(100, percent)}% }}
/>
</div>
</div>
// No re-render triggered."solution)Only these trigger re-render. renderOptions(via independent
);

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

}
  // Progress memory displayed",job Clear old task memory on switch.,Otherwise new task same-name stage will
  // Reuse old task display progress as animation start.
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
    // selected/selectedIsCurrent/snapshot/selectedProgress All from props Derived value,
    // Refs auto-update on upstream snapshot change.,Re-run animation check on dependency table change.——
    // 与旧世界 render({selected,...}) Temporal equivalence: each snapshot callback invoked once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedIsCurrent, snapshot, selectedProgress]);

  useEffect(() => clear, []);

  return renderOptions;
}
