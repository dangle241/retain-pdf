// Shortcut help: bottom bar keyboard icon + Popover list;h / ? Also openable.

import { useEffect, useId, useRef, useState } from "react";
import { Keyboard } from "lucide-react";

const SHORTCUT_GROUPS: { title: string; items: { keys: string; desc: string }[] }[] = [
  {
    title: "Page turning",
    items: [
      { keys: "J · ↓ · PgDn", desc: "Next page" },
      { keys: "K · ↑ · PgUp", desc: "上一页" },
      { keys: "Home / End", desc: "Home / Last" },
      { keys: "Click the page number in the bottom bar.", desc: "Go to page" },
    ],
  },
  {
    title: "Zoom",
    items: [
      { keys: "+ / −", desc: "Zoom In / 缩小" },
      { keys: "0", desc: "Đã đặt lại về chế độ mặc định. Tôi sẽ trả lời theo phong cách thông thường, đầy đủ và hữu ích. Bạn cần hỗ trợ gì tiếp theo?" },
      { keys: "Point Percentage", desc: "重置为模式默认" },
    ],
  },
  {
title: "Mode",
    items: [
      { keys: "1", desc: "原文" },
      { keys: "2", desc: "译文" },
      { keys: "3", desc: "对照阅读" },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function ReaderShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key;
      if (key === "?" || key === "h" || key === "H" || key === "/") {
        // / On some keyboards ? not yet shiftAlso accept h
        if (key === "/" && !event.shiftKey) {
          // Individually / Prevent accidental help trigger.
          return;
        }
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="reader-react-shortcuts" ref={rootRef} data-reader-shortcuts="">
      <button
        type="button"
        className={`reader-react-hud-btn reader-react-shortcuts-btn${open ? " is-active" : ""}`}
        aria-label="Shortcuts"
        aria-expanded={open}
        aria-controls={panelId}
title="Shortcuts (H or ?)"
        onClick={() => setOpen((v) => !v)}
      >
        <Keyboard className="reader-react-shortcuts-icon" size={16} strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          className="reader-react-shortcuts-panel"
          role="dialog"
          aria-label="reader shortcuts"
        >
          <div className="reader-react-shortcuts-head">
<strong>Shortcuts</strong>
            <button
              type="button"
              className="reader-react-shortcuts-close"
aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="reader-react-shortcuts-body">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="reader-react-shortcuts-group">
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${group.title}-${item.keys}`}>
                      <kbd>{item.keys}</kbd>
                      <span>{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="reader-react-shortcuts-foot">Shortcuts not triggered inside input.</p>
        </div>
      ) : null}
    </div>
  );
}
