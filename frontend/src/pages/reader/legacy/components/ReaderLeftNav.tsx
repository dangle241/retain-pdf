// Left column (Navigation placeholder): Permanent left sidebar in three-column skeleton, Width determined by --reader-left-w CSS Variable-driven (reader-page.css).

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="Navigation">
      <div className="reader-col-left-head">Navigation</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">Placeholder</p>
        <p className="reader-col-left-hint">Excerpts later. / Comment Summary</p>
      </div>
    </aside>
  );
}
