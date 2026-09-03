import { stringifyPretty } from "../../composition/external.js";

// Two small display blocks used by Translation debug detail/replay panels — JSX rewrite
// of features/status-detail/formatters.js renderField/renderTextBlock (both were
// markup concatenation, condemned by blueprint §1.1); stringifyPretty is a pure
// formatting function, kept for direct import.

export function InfoRow({ label, value }) {
  return (
    <div className="info-row translation-detail-row">
      <span className="label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

export function TextBlock({ label, value }) {
  return (
    <section className="translation-text-block">
      <div className="translation-debug-subhead">
        <h4>{label}</h4>
      </div>
      <pre>{stringifyPretty(value)}</pre>
    </section>
  );
}


