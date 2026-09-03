// Task options tab (Side-by-side with old components/dialogs/browser-credentials-dialog.js's
// "task" panel — Formula Mode dropdown; model address/name not rendered in old template but
// dialog-values.js/dialog-sync.js (kept) still read/write these fields, here we add
// corresponding uncontrolled ref containers, keeping field contract complete without changing visible layout).

import { useCredentialsController } from "./useCredentialsController.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function TaskOptionsPanel({ hidden = false } = {}) {
  const { elementsRef } = useCredentialsController();

  return (
    <section
      className={`credential-card credential-panel${hidden ? "" : " is-active"}`}
      data-credential-panel="task"
      role="tabpanel"
      hidden={hidden}
    >
      <div className="credential-card-grid credential-card-grid-compact">
        <section className="credential-card">
          <div className="credential-card-head">
            <h3>Task Options</h3>
          </div>
          <label>
            <span className="developer-label">
              <span>Formula Mode</span>
            </span>
            <select
              id={BROWSER_IDS.mathMode}
              aria-label="Formula Mode"
              defaultValue="direct_typst"
              ref={(node) => { elementsRef.mathModeSelect = node || null; }}
            >
              <option value="placeholder">Placeholder</option>
              <option value="direct_typst">Direct Typst</option>
            </select>
          </label>
          {/* Model address/name not in old template's visible layout, but dialog-values.js/
              dialog-sync.js still read/write these fields — keep hidden field contract, no new visible UI. */}
          <input
            id={BROWSER_IDS.modelBaseUrl}
            name="model_base_url"
            type="hidden"
            defaultValue=""
            ref={(node) => { elementsRef.modelBaseUrlInput = node || null; }}
          />
          <input
            id={BROWSER_IDS.modelName}
            name="model_name"
            type="hidden"
            defaultValue=""
            ref={(node) => { elementsRef.modelNameInput = node || null; }}
          />
        </section>
      </div>
    </section>
  );
}



