// Bảng danh sách thuật ngữ, đối chiếu vùng .glossary-list-panel trong
// glossary-manager-dialog-template.js + phản chiếu từng nút view.js:renderGlossaryList.

import { EmptyState } from "../../../../shared/icons/EmptyState.jsx";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";

export function GlossaryList({ items, selectedId, onSelect, onCreateNew }) {
  const hasItems = items.length > 0;
  return (
    <aside className="glossary-list-panel">
      <div className="glossary-panel-head">
        <strong>Danh sách</strong>
        <button
          id={GLOSSARY_DOM_IDS.newButton}
          type="button"
          className="app-button secondary"
          onClick={onCreateNew}
        >
          Tạo mới
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
              <span>{Number(item.entry_count) || 0} mục</span>
            </button>
          );
        })}
      </div>
      <div id={GLOSSARY_DOM_IDS.listEmpty} className={hasItems ? "hidden" : undefined}>
        {!hasItems ? (
          <EmptyState
            instrument="atom"
            title="Chưa có bảng thuật ngữ"
            hint="Bấm “Tạo mới” ở góc trên bên phải để lập bảng đối chiếu thuật ngữ chuyên ngành."
          />
        ) : null}
      </div>
    </aside>
  );
}
