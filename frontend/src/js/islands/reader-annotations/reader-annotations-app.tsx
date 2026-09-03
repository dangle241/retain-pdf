import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ANNOTATION_KIND_META,
  annotationAnchor,
  buildAnnotationsMarkdown,
  groupAnnotationsByPage,
} from "../../reader/annotations/view-model.js";

function AnnotationItem({ annotation, onJump, onDelete, onSaveNote }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const meta = ANNOTATION_KIND_META[annotation.kind] || ANNOTATION_KIND_META.sentence;

  const startEdit = () => {
    setDraft(annotation.note || "");
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    await onSaveNote(annotation, draft);
  };

  return (
    <div className="reader-annotations-item">
      <div className="reader-annotations-item-top">
        <span className={`reader-annotations-kind is-${annotation.kind}`}>{meta.label}</span>
        <div className="reader-annotations-actions">
          <button
            type="button"
            className="reader-annotations-locate"
            onClick={() => onJump(annotationAnchor(annotation))}
          >
            Locate
          </button>
          <button
            type="button"
            className="reader-annotations-remove"
            onClick={() => onDelete(annotation)}
          >
            Delete
          </button>
        </div>
      </div>
      <p className="reader-annotations-quote">{annotation.quoteText}</p>
      {annotation.translatedQuoteText
        ? <p className="reader-annotations-translated">{annotation.translatedQuoteText}</p>
        : null}
      {editing
        ? (
          <div className="reader-annotations-note-editor">
            <textarea
              className="reader-annotations-note-input"
              value={draft}
              placeholder="Write a note..."
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="reader-annotations-note-editor-actions">
              <button type="button" className="reader-annotations-note-save" onClick={commit}>Save</button>
              <button type="button" className="reader-annotations-note-cancel" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )
        : annotation.note
          ? (
            <p className="reader-annotations-note" title="Click to edit note" onClick={startEdit}>
              {annotation.note}
            </p>
          )
          : (
            <button type="button" className="reader-annotations-note-add" onClick={startEdit}>
              Add note
            </button>
          )}
    </div>
  );
}

// Named export: reader page (src/pages/reader) is bundled; reuse component source for rendering
// annotations drawer (Phase 2b); mountReaderAnnotationsApp kept as mount entry for component tests.
export function ReaderAnnotationsPanel({ ports }) {
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const loadSeqRef = useRef(0);
  const copyTimerRef = useRef<any>(0);

  const load = useCallback(async () => {
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    setLoading(true);
    setError("");
    try {
      const list = await ports.loadAnnotations();
      if (loadSeqRef.current !== seq) {
        return;
      }
      setAnnotations(Array.isArray(list) ? list : []);
    } catch (loadError) {
      if (loadSeqRef.current === seq) {
        setError(loadError?.message || "Failed to load annotations");
      }
    } finally {
      if (loadSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, [ports]);

  useEffect(() => ports.subscribeOpen((visible) => setOpen(Boolean(visible))), [ports]);

  // Load on first visibility, then refresh each time it becomes visible again
  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleExport = useCallback(async () => {
    const markdown = buildAnnotationsMarkdown({
      title: ports.documentTitle(),
      annotations,
    });
    const ok = await ports.exportMarkdown(markdown);
    if (ok) {
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [ports, annotations]);

  const handleDelete = useCallback(async (annotation) => {
    // Optimistic remove, restore on failure
    setAnnotations((current) => current.filter((item) => item.favoriteId !== annotation.favoriteId));
    let ok = false;
    try {
      ok = await ports.deleteAnnotation(annotation.favoriteId);
    } catch (_err) {
      ok = false;
    }
    if (!ok) {
      setAnnotations((current) => (
        current.some((item) => item.favoriteId === annotation.favoriteId)
          ? current
          : [...current, annotation]
      ));
    }
  }, [ports]);

  const handleSaveNote = useCallback(async (annotation, note) => {
    const previousNote = annotation.note;
    // Optimistic update, roll back on failure
    setAnnotations((current) => current.map((item) => (
      item.favoriteId === annotation.favoriteId ? { ...item, note } : item
    )));
    let updated = null;
    try {
      updated = await ports.saveNote(annotation, note);
    } catch (_err) {
      updated = null;
    }
    setAnnotations((current) => current.map((item) => (
      item.favoriteId === annotation.favoriteId
        ? (updated || { ...item, note: previousNote })
        : item
    )));
  }, [ports]);

  if (!open) {
    return null;
  }

  const groups = groupAnnotationsByPage(annotations);

  return (
    <div className="reader-annotations-panel" role="region" aria-label="Annotation list">
      <div className="reader-annotations-head">
        <span className="reader-annotations-count">{annotations.length} entriesannotations</span>
        <button
          type="button"
          className="reader-annotations-export"
          onClick={handleExport}
          disabled={copied}
        >
          {copied ? "Copied" : "Export Markdown"}
        </button>
      </div>
      {loading
        ? <p className="reader-annotations-loading">Loading annotations...</p>
        : error
          ? (
            <div className="reader-annotations-error">
              <p>{error}</p>
              <button type="button" className="reader-annotations-retry" onClick={load}>Retry</button>
            </div>
          )
          : groups.length === 0
            ? <p className="reader-annotations-empty">No annotations. Select source text to create one.</p>
            : groups.map((group) => (
              <section key={group.pageIdx} className="reader-annotations-group">
                <h4 className="reader-annotations-group-title">Page {group.pageIdx + 1} pages</h4>
                <div className="reader-annotations-group-items">
                  {group.items.map((annotation) => (
                    <AnnotationItem
                      key={annotation.favoriteId}
                      annotation={annotation}
                      onJump={ports.jumpToAnchor}
                      onDelete={handleDelete}
                      onSaveNote={handleSaveNote}
                    />
                  ))}
                </div>
              </section>
            ))}
    </div>
  );
}

export function mountReaderAnnotationsApp(host, ports) {
  const root = createRoot(host);
  root.render(<ReaderAnnotationsPanel ports={ports} />);
  return {
    unmount: () => root.unmount(),
  };
}




