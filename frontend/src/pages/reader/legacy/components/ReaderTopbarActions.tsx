// Topbar action group: four tool toggle buttons + download menu.
// Open/close status subscribes to drawer store (replaces old side-drawers.js imperative
// aria-expanded/is-active writes); download menu is a React component, context injected
// by boot after manifest loads.

import { useDrawerActive } from "../state/use-drawer-active.js";
import { ReaderDownloadMenu } from "./ReaderDownloadMenu.jsx";

const TOOL_BUTTONS = [
  { key: "markdown", id: "reader-markdown-toggle-btn", controls: "reader-markdown-drawer", label: "Markdown" },
  { key: "favorites", id: "reader-favorites-toggle-btn", controls: "reader-favorites-drawer", label: "Excerpt" },
  { key: "annotations", id: "reader-annotations-toggle-btn", controls: "reader-annotations-drawer", label: "annotations" },
  { key: "ai", id: "reader-ai-toggle-btn", controls: "reader-ai-drawer", label: "AI Q&A" },
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


