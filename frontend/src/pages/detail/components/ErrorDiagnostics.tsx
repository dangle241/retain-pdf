// Failure Debug Context #detail-failure-debug-context is an "Imperative Island":
// Content written via innerHTML after data load by legacy module src/js/job-detail/failure.js (via overview-renderer.js)
// Written via innerHTML after data load. React Sidebar usage memo pinned to leaf container.
// Skip dynamic child render,Re-render won't touch imperatively written content.

import { memo } from "react";

export const ErrorDiagnostics = memo(function ErrorDiagnostics() {
  return (
    <article className="detail-card detail-card-wide">
      <h2>Failure Debug Context</h2>
      <div id="detail-failure-debug-context" className="detail-debug-context">
<div className="detail-empty">No structured failure context available</div>
      </div>
    </article>
  );
});
