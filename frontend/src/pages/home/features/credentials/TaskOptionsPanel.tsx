// Tab tùy chọn tác vụ chỉ chứa các thiết lập xử lý tài liệu. Cấu hình nhà cung cấp,
// Base URL và model được đặt cạnh API Key trong thẻ API dịch.

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
            <h3>Tùy chọn tác vụ</h3>
          </div>
          <label>
            <span className="developer-label">
              <span>Chế độ công thức</span>
            </span>
            <select
              id={BROWSER_IDS.mathMode}
              aria-label="Chế độ công thức"
              defaultValue="direct_typst"
              ref={(node) => { elementsRef.mathModeSelect = node || null; }}
            >
              <option value="placeholder">Bảo vệ chỗ giữ chỗ</option>
              <option value="direct_typst">Xuất công thức trực tiếp</option>
            </select>
          </label>
        </section>
      </div>
    </section>
  );
}
