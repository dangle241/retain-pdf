// Notion-style left History: collapsible + Rename + grouped by time

import { useEffect, useRef, useState } from "react";
import {
  Check,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { HomeAskSession } from "./use-home-ask-runtime.js";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupLabel(updatedAt: string, now = Date.now()): string {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return "Older";
  const day = startOfDay(new Date(t));
  const today = startOfDay(new Date(now));
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Past 7 days";
  if (diffDays < 30) return "Past 30 days";
  return "Older";
}

function groupSessions(sessions: HomeAskSession[]) {
  const order = ["Today", "Yesterday", "Past 7 days", "Past 30 days", "Older"];
  const map = new Map<string, HomeAskSession[]>();
  for (const s of sessions) {
    const label = groupLabel(s.updatedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(s);
  }
  return order
    .filter((k) => map.has(k))
    .map((label) => ({ label, items: map.get(label)! }));
}

function displayTitle(raw: string): string {
  const m = `${raw || ""}`.match(/^fork-(\d+)-(.*)$/i);
  if (!m) return raw || "Untitled conversation";
  const rest = m[2].trim();
  return rest ? `${rest} · branch${m[1]}` : `branch${m[1]}`;
}

export type HomeAskSidebarProps = {
  sessions: HomeAskSession[];
  activeId: string;
  loading?: boolean;
  busy?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void | Promise<boolean>;
};

export function HomeAskSidebar({
  sessions,
  activeId,
  loading = false,
  busy = false,
  collapsed = false,
  onCollapsedChange,
  onNew,
  onSelect,
  onDelete,
  onRename,
}: HomeAskSidebarProps) {
  const groups = groupSessions(sessions);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const el = editInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingId]);

  const startRename = (s: HomeAskSession) => {
    if (busy) return;
    setEditingId(s.id);
    // Edit box shows the stored original name (allow full edit even with fork-n- prefix)
    setEditTitle(s.title || "");
  };

  const cancelRename = () => {
    setEditingId("");
    setEditTitle("");
  };

  const commitRename = async () => {
    const id = editingId;
    const title = editTitle.trim();
    if (!id) return;
    if (!title) {
      cancelRename();
      return;
    }
    setEditingId("");
    await onRename(id, title);
  };

  if (collapsed) {
    return (
      <aside
        className="home-ask-sidebar is-collapsed"
        aria-label="Conversation history (collapsed)"
      >
        <button
          type="button"
          className="home-ask-sidebar-icon-btn"
          title="Expand history"
          aria-label="Expand conversation history"
          aria-expanded={false}
          onClick={() => onCollapsedChange?.(false)}
        >
          <PanelLeftOpen size={16} strokeWidth={2.1} aria-hidden />
        </button>
        <button
          type="button"
          className="home-ask-sidebar-icon-btn"
          disabled={busy}
          title="New conversation"
          aria-label="New conversation"
          onClick={onNew}
        >
          <MessageSquarePlus size={16} strokeWidth={2.1} aria-hidden />
        </button>
      </aside>
    );
  }

  return (
    <aside className="home-ask-sidebar" aria-label="Conversation history">
      <div className="home-ask-sidebar-head">
        <div className="home-ask-sidebar-head-row">
          <span className="home-ask-sidebar-brand">History</span>
          <button
            type="button"
            className="home-ask-sidebar-icon-btn home-ask-sidebar-collapse"
            title="Collapse sidebar"
            aria-label="Collapse conversation history"
            aria-expanded={true}
            onClick={() => onCollapsedChange?.(true)}
          >
            <PanelLeftClose size={15} strokeWidth={2.1} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className="home-ask-sidebar-new"
          disabled={busy}
          title="New conversation"
          onClick={onNew}
        >
          <MessageSquarePlus size={15} strokeWidth={2.1} aria-hidden />
          <span>New conversation</span>
        </button>
      </div>

      <div className="home-ask-sidebar-scroll">
        {loading && sessions.length === 0 ? (
          <p className="home-ask-sidebar-empty">Loading history...</p>
        ) : sessions.length === 0 ? (
          <p className="home-ask-sidebar-empty">No conversations</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="home-ask-sidebar-group">
              <div className="home-ask-sidebar-group-label">{g.label}</div>
              <ul className="home-ask-sidebar-list">
                {g.items.map((s) => {
                  const active = s.id === activeId;
                  const title = displayTitle(s.title);
                  const editing = editingId === s.id;
                  return (
                    <li key={s.id} className="home-ask-sidebar-row">
                      {editing ? (
                        <div className="home-ask-sidebar-edit">
                          <input
                            ref={editInputRef}
                            className="home-ask-sidebar-edit-input"
                            value={editTitle}
                            maxLength={80}
                            disabled={busy}
                            aria-label="Conversation title"
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            type="button"
                            className="home-ask-sidebar-icon-btn"
                            disabled={busy || !editTitle.trim()}
                            aria-label="Save title"
                            title="Save"
                            onClick={(e) => {
                              e.stopPropagation();
                              void commitRename();
                            }}
                          >
                            <Check size={13} strokeWidth={2.5} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-icon-btn"
                            disabled={busy}
                            aria-label="Cancel rename"
                            title="Cancel"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelRename();
                            }}
                          >
                            <X size={13} strokeWidth={2.5} aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`home-ask-sidebar-item${active ? " is-active" : ""}`}
                            disabled={busy}
                            title={`${title}(double-click to rename)`}
                            onClick={() => onSelect(s.id)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startRename(s);
                            }}
                          >
                            <span className="home-ask-sidebar-item-title">{title}</span>
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-rename"
                            disabled={busy}
                            aria-label={`Rename ${title}`}
                            title="Rename"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(s);
                            }}
                          >
                            <Pencil size={12} strokeWidth={2.2} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="home-ask-sidebar-del"
                            disabled={busy}
                            aria-label={`Delete ${title}`}
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = globalThis.confirm?.(`Delete conversation"${title}"?`);
                              if (ok) onDelete(s.id);
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2.2} aria-hidden />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}




