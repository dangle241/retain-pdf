import { stringifyPretty } from "../../composition/external.js";

// Debug details/Two small display blocks shared by the replay panel.ââJSX rewrite
// DOWNLOAD_ACTION_IDS from contracts/, not in restricted area, import as-is). id strings
// keep each one. — smoke DOM contract (blueprint §0) these id assertions.
<ItemRow

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
