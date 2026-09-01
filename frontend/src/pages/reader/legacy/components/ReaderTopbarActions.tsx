// Top bar action group:Four tool toggle buttons + Download menu.
// Open/Close State Subscription drawer store(Replace side-drawers.js OK aria-expanded/is-active
// imperative writes of); Download as React component, context injected by boot after manifest loads.

import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderDownloadMenu } from "./ReaderDownloadMenu.jsx";

const TOOL_BUTTONS = [
  { key: "markdown", id: "reader-markdown-toggle-btn", controls: "reader-markdown-drawer", label: "Markdown" },
  { key: "favorites", id: "reader-favorites-toggle-btn", controls: "reader-favorites-drawer", label: "摘录" },
  { key: "annotations", id: "reader-annotations-toggle-btn", controls: "reader-annotations-drawer", label: "批注" },
  { key: "ai", id: "reader-ai-toggle-btn", controls: "reader-ai-drawer", label: "AI 问答" },
];

export function ReaderTopbarActions({ drawerStore, downloadContext }) {
  const active = useDrawerActive(drawerStore);
  return (
    <div className="reader-topbar-actions">
      {TOOL_BUTTONS.map(({ key, id, controls, label }) => {
        const open = active === key;
        return (
          <button
            key={key}
            id={id}
            type="button"
            className={open ? "reader-topbar-action-btn is-active" : "reader-topbar-action-btn"}
            aria-expanded={open ? "true" : "false"}
            aria-controls={controls}
            onClick={() => drawerStore.toggle(key)}
          >{label}</button>
        );
      })}
      <ReaderDownloadMenu context={downloadContext} />
    </div>
  );
}
