// Homepage AI Input bar: @ Select document / collection + chips + send

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowUp, BookOpen, FolderOpen, Loader2, Square, X } from "lucide-react";
import {
  filterDocumentOptions,
  loadPickerOptions,
  parseAtQuery,
} from "./document-picker.js";
import type { HomeAskScope } from "./types.js";
import { scopeKey } from "./types.js";

const MAX_SCOPES = 4;

export type HomeAskComposerProps = {
  disabled?: boolean;
  isRunning?: boolean;
  /** Model not configured Key Disable send on timeout. Show prompt. */
  missingLlmKey?: boolean;
  scopes: HomeAskScope[];
  onScopesChange: (next: HomeAskScope[]) => void;
  onSend: (question: string) => void;
  onStop?: () => void;
  /** herohero: centered large input for empty state;dockchat bottom bar */
  variant?: "hero" | "dock";
};

export function HomeAskComposer({
  disabled = false,
  isRunning = false,
  missingLlmKey = false,
  scopes,
  onScopesChange,
  onSend,
  onStop,
  variant = "dock",
}: HomeAskComposerProps) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<HomeAskScope[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [atStart, setAtStart] = useState(-1);
  const [atQuery, setAtQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const listId = useId();

  const filtered = filterDocumentOptions(
    options,
    atQuery,
    scopes.map((s) => scopeKey(s)),
  );

  const ensureOptions = useCallback(async () => {
    if (optionsLoaded || loadingOpts) return;
    setLoadingOpts(true);
    try {
      const list = await loadPickerOptions(100);
      setOptions(list);
      setOptionsLoaded(true);
    } catch {
      setOptions([]);
      setOptionsLoaded(true);
    } finally {
      setLoadingOpts(false);
    }
  }, [loadingOpts, optionsLoaded]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setAtStart(-1);
    setAtQuery("");
    setHighlight(0);
  }, []);

  const pickScope = useCallback((item: HomeAskScope) => {
    if (!item.id) return;
    if (scopes.some((s) => scopeKey(s) === scopeKey(item))) {
      closePicker();
      return;
    }
    if (scopes.length >= MAX_SCOPES) {
      closePicker();
      return;
    }
    const el = textareaRef.current;
    const value = text;
    const start = atStart >= 0 ? atStart : value.lastIndexOf("@");
    if (start >= 0 && el) {
      const caret = el.selectionStart ?? value.length;
      const next = `${value.slice(0, start)}${value.slice(caret)}`.replace(/\s{2,}/g, " ");
      setText(next.trimStart());
    }
    onScopesChange([...scopes, item]);
    closePicker();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [atStart, closePicker, onScopesChange, scopes, text]);

  const syncAtState = useCallback((value: string, caret: number) => {
    const parsed = parseAtQuery(value, caret);
    if (!parsed) {
      if (pickerOpen) closePicker();
      return;
    }
    void ensureOptions();
    setAtStart(parsed.start);
    setAtQuery(parsed.query);
    setPickerOpen(true);
    setHighlight(0);
  }, [closePicker, ensureOptions, pickerOpen]);

  const handleSend = () => {
    const q = text.trim();
    if (!q || disabled || isRunning || missingLlmKey) return;
    onSend(q);
    setText("");
    closePicker();
  };

  const inputDisabled = disabled || missingLlmKey;

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen && filtered.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        pickScope(filtered[highlight] || filtered[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node | null;
      const root = textareaRef.current?.closest(".home-ask-composer");
      if (root && t && root.contains(t)) return;
      closePicker();
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [closePicker, pickerOpen]);

  const canSend = Boolean(text.trim()) && !disabled && !isRunning && !missingLlmKey;

  const scopeHint = (() => {
    if (missingLlmKey) return "Go to Settings first. → API Enter model in settings API Key";
    if (!scopes.length) return "All Libraries · @ Article or Collection";
    const cols = scopes.filter((s) => s.kind === "collection").length;
    const docs = scopes.filter((s) => s.kind === "document").length;
    const parts: string[] = [];
if (cols) parts.push(`${cols} collections`);
    if (docs) parts.push(`${docs} articles`);
    return parts.join(" · ") || "Limited";
  })();

  return (
    <div className={`home-ask-composer home-ask-composer-${variant}${missingLlmKey ? " is-locked" : ""}`}>
      {missingLlmKey ? (
        <div className="home-ask-key-banner" role="alert">
          <p>Model not configured API KeyUnable to input or ask questions.</p>
          <button
            type="button"
            className="home-ask-key-banner-btn"
            onClick={() => {
// Consistent with upload access control: open "Settings â API Settings" (only regular entry)
              document.dispatchEvent(
                new CustomEvent("retainpdf:open-browser-credentials"),
              );
            }}
          >
            Open Settings
          </button>
        </div>
      ) : null}
      {scopes.length > 0 ? (
        <div className="home-ask-chips" aria-label="Question Scope">
          {scopes.map((s) => (
            <span
              key={scopeKey(s)}
              className={`home-ask-chip${s.kind === "collection" ? " is-collection" : ""}`}
            >
              {s.kind === "collection" ? (
                <FolderOpen size={12} strokeWidth={2.2} aria-hidden />
              ) : (
                <BookOpen size={12} strokeWidth={2.2} aria-hidden />
              )}
              <span className="home-ask-chip-label" title={s.title}>
                {s.kind === "collection" ? `Collection · ${s.title}` : s.title}
              </span>
              <button
                type="button"
                className="home-ask-chip-remove"
                aria-label={`Remove ${s.title}`}
                disabled={disabled || isRunning}
                onClick={() => onScopesChange(scopes.filter((x) => scopeKey(x) !== scopeKey(s)))}
              >
                <X size={12} strokeWidth={2.4} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="home-ask-composer-shell" aria-disabled={missingLlmKey || undefined}>
        {/* Lock layer: block all input (more than just disabled More stable */}
        {missingLlmKey ? (
          <div
            className="home-ask-composer-lock"
            aria-hidden
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          className="home-ask-input"
          rows={2}
          value={missingLlmKey ? "" : text}
          disabled={inputDisabled}
          readOnly={missingLlmKey}
          tabIndex={missingLlmKey ? -1 : 0}
          aria-disabled={missingLlmKey}
          placeholder={
            missingLlmKey
              ? "Please configure the model first API Key…"
              : scopes.length
                ? "Continue asking… @ Reassign article or collection"
                : variant === "hero"
? "Do anything with AI... enter @ to specify article or collection"
: "Continue asking... enter @ to specify article or collection"
          }
          onChange={(e) => {
            if (missingLlmKey) return;
            const value = e.target.value;
            setText(value);
            syncAtState(value, e.target.selectionStart ?? value.length);
          }}
          onBeforeInput={(e) => {
            if (missingLlmKey) e.preventDefault();
          }}
          onPaste={(e) => {
            if (missingLlmKey) e.preventDefault();
          }}
          onClick={(e) => {
            if (missingLlmKey) {
              e.preventDefault();
              return;
            }
            const t = e.currentTarget;
            syncAtState(t.value, t.selectionStart ?? t.value.length);
          }}
          onKeyUp={(e) => {
            if (missingLlmKey) return;
            const t = e.currentTarget;
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              syncAtState(t.value, t.selectionStart ?? t.value.length);
            }
          }}
          onKeyDown={(e) => {
            if (missingLlmKey) {
              e.preventDefault();
              return;
            }
            onKeyDown(e);
          }}
        />

        {pickerOpen ? (
          <div className="home-ask-picker" role="listbox" id={listId} aria-label="select document or collection">
            {loadingOpts && !optionsLoaded ? (
              <div className="home-ask-picker-empty">
                <Loader2 className="home-ask-spin" size={14} aria-hidden />
                Loading...…
              </div>
            ) : filtered.length === 0 ? (
              <div className="home-ask-picker-empty">
                {optionsLoaded ? "No matching articles or collections." : "No data"}
              </div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={scopeKey(item)}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`home-ask-picker-item${index === highlight ? " is-active" : ""}${
                    item.kind === "collection" ? " is-collection" : ""
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pickScope(item)}
                >
                  {item.kind === "collection" ? (
                    <FolderOpen size={14} strokeWidth={2} aria-hidden />
                  ) : (
                    <BookOpen size={14} strokeWidth={2} aria-hidden />
                  )}
                  <span className="home-ask-picker-title">{item.title}</span>
                  <span className="home-ask-picker-kind">
                    {item.kind === "collection"
? `Collection${item.document_count != null ? ` Â· ${item.document_count}` : ""}`
                      : "Articles"}
                  </span>
                </button>
              ))
            )}
            {scopes.length >= MAX_SCOPES ? (
              <div className="home-ask-picker-hint">Max {MAX_SCOPES} Range</div>
            ) : (
              <div className="home-ask-picker-hint">Expand collection to re-search included references.</div>
            )}
          </div>
        ) : null}

        <div className="home-ask-toolbar">
          <span className="home-ask-scope-hint">{scopeHint}</span>
          {isRunning ? (
            <button
              type="button"
              className="home-ask-send home-ask-send-stop"
              aria-label="Stop generating"
title="Stop generating"
              disabled={!onStop}
              onClick={() => onStop?.()}
            >
              <Square size={12} strokeWidth={2.6} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="home-ask-send"
              aria-label="Send"
              disabled={!canSend}
              onClick={handleSend}
            >
              <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
