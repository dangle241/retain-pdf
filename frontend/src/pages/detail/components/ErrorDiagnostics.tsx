// Failure debug context card. #detail-failure-debug-context is an "imperative island":
// its content is written via innerHTML by the retained legacy module src/js/job-detail/failure.js
// (via overview-renderer.js) after data load. The React side uses memo to lock this down
// as a leaf container, does not render dynamic child nodes, and re-renders will not touch
// the content written imperatively.

import { memo } from "react";

export const ErrorDiagnostics = memo(function ErrorDiagnostics() {
  return (
    <article className="detail-card detail-card-wide">
      <h2>Failure Debug Context</h2>
      <div id="detail-failure-debug-context" className="detail-debug-context">
        <div className="detail-empty">No structured failure context</div>
      </div>
    </article>
  );
});




