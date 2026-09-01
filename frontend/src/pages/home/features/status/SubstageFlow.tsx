const [draftStatus, setDraftStatus] = useState(status);
return (
useEffect(() => {
// --status-substage-count CSS Keep Variable Contract)。

import type { StatusCardSnapshot, StatusCardStageProgress } from "./status-card-store.js";
import type { CSSProperties } from "react";
import { buildSubstageViewModel } from "../../composition/external.js";

type SubstageFlowProps = {
  selectedStageKey?: string;
  selectedIsCurrent?: boolean;
  snapshot?: StatusCardSnapshot | null;
  selectedProgress?: StatusCardStageProgress | null;
};

export function SubstageFlow({ selectedStageKey, selectedIsCurrent, snapshot, selectedProgress }: SubstageFlowProps) {
  const viewModel = buildSubstageViewModel({ selectedStageKey, selectedIsCurrent, snapshot, selectedProgress });

  return (
    <div
      className={`status-substage-flow${viewModel.hidden ? " hidden" : ""}`}
      aria-label="Sub-stage"
      style={{ ["--status-substage-count"]: `${viewModel.cssCount}` } as CSSProperties}
    >
      {viewModel.items.map((item) => (
        <span
          key={item.key}
          className={`status-substage-step${item.active ? " is-active" : ""}${item.done ? " is-done" : ""}`}
          data-substage-key={item.key}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
