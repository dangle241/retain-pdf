// 术语表列表面板(对照 glossary-manager-dialog-template.js 的
// .glossary-list-panel 区块 + view.js:renderGlossaryList 逐节点镜像)。

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryList({ items, selectedId, onSelect, onCreateNew }) {
  const hasItems = items.length > 0;
  return (
    <aside className="glossary-list-panel">
      <div className="glossary-panel-head">
        <strong>List</strong>
        <button
          id={GLOSSARY_DOM_IDS.newButton}
          type="button"
          className="app-button secondary"
          onClick={onCreateNew}
        >
          New
        </button>
      </div>
      <div id={GLOSSARY_DOM_IDS.list} className="glossary-list">
        {items.map((item) => {
          const glossaryId = `${item?.glossary_id || ""}`.trim();
          if (!glossaryId) {
            return null;
          }
          return (
            <button
              key={glossaryId}
              type="button"
              className={`glossary-list-item${glossaryId === selectedId ? " is-active" : ""}`}
              onClick={() => onSelect(glossaryId)}
            >
              <strong>{item.name || glossaryId}</strong>
              <span>{Number(item.entry_count) || 0} entries</span>
            </button>
          );
        })}
      </div>
      <div id={GLOSSARY_DOM_IDS.listEmpty} className={hasItems ? "hidden" : undefined}>
        {!hasItems ? (
          <EmptyState
            instrument="atom"
            title="No glossaries yet"
            hint="Click New in the top-right to create a glossary for your domain terms."
          />
        ) : null}
      </div>
    </aside>
  );
}
