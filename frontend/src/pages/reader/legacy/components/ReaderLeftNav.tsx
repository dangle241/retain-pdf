// Left column (navigation placeholder): permanent left column in three-column skeleton,
// width driven by --reader-left-w CSS variable (reader-page.css).

export function ReaderLeftNav() {
  return (
    <aside id="reader-col-left" className="reader-col-left" aria-label="Navigation">
      <div className="reader-col-left-head">Navigation</div>
      <div className="reader-col-left-body">
        <p className="reader-col-left-placeholder">Placeholder</p>
        <p className="reader-col-left-hint">Excerpt / annotations summary will go here</p>
      </div>
    </aside>
  );
}


