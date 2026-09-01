// Task options tab (compare with old components/dialogs/browser-credentials-dialog.js's
// "task" panel ââ Formula mode dropdown; Model URL/Model name missing in legacy template. Check prop passing. Verify render logic.
// dialog-values.js/dialog-sync.js(kept)Still reads/writes corresponding fields.,supplement the corresponding here
// Uncontrolled ref container, Preserve field contract integrity. Preserve visible layout.).

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
              <option value="placeholder">Placeholder Protection</option>
              <option value="direct_typst">Direct Output Formula</option>
            </select>
          </label>
{/* Model URL/Model name not in old template visible layout, but dialog-values.js/
              dialog-sync.js Continue to read and write these two fields.——Preserve hidden field contract,Don't show new UI。 */}
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
