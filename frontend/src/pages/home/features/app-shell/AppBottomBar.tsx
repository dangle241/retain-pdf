// Thanh nổi ba trong một ở đáy: thêm bên trái, tìm kiếm ở giữa, cài đặt bên phải, hợp thành một thanh.
// Hợp nhất AppBottomActions cũ (capsule thêm/cài đặt góc dưới phải) + LibrarySearchDock
// (thanh tìm kiếm giữa đáy); trước là hai đảo nổi riêng, nay thành một thanh kính ở giữa.
//
// Giữ toàn bộ id hợp đồng: library-add-pdf-btn / app-settings-btn / library-search-input
// (test + library-search-island đều tìm phần tử theo các id này).
//
// Điểm chính: hidden dùng CSS display:none, không gỡ; ô tìm kiếm luôn ở trong DOM;
// library-search-island dùng getElementById trong connectedCallback để giữ tham chiếu input,
// nếu gỡ rồi gắn lại như khi vào/ra chế độ hàng loạt, tham chiếu mất hiệu lực và tìm kiếm âm thầm hỏng (rủi ro
// từ lượt chọn hàng loạt trước). Dùng ẩn thay vì gỡ để tham chiếu luôn hợp lệ.
// showSearch=false dùng cho tab "Phân loại": ngữ nghĩa tìm kiếm ở tab này khác nên không kết xuất input (test
// xác nhận #library-search-input không tồn tại trong tab phân loại), chỉ giữ thêm/cài đặt.

import { useHomeServices } from "../../home-services-context.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useLibrarySearchBinding } from "../library/page/RecentJobsLibrary.jsx";
import { TRANSLATION_WORKFLOW_DIALOG } from "../../composition/external.js";

export function AppBottomBar({ showSearch = true, hidden = false }) {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const open = Boolean(dialog.open);
  // Hook không được gọi có điều kiện; luôn đăng ký, chỉ kết xuất input khi showSearch (trong tab phân loại
  // chỉ giữ query mà không hiển thị, không có tác dụng phụ).
  const { query, onSearchChange } = useLibrarySearchBinding();

  return (
    <div className={`library-bottom-bar${hidden ? " is-hidden" : ""}`} aria-label="Thanh thao tác nhanh">
      <button
        id="library-add-pdf-btn"
        type="button"
        className={`library-bottom-icon-btn primary${open ? " is-active" : ""}`}
        aria-label="Thêm PDF"
        title="Thêm PDF"
        aria-controls="translation-workflow-dialog"
        aria-expanded={open ? "true" : "false"}
        data-workflow-open={open
          ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
          : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed}
        data-workflow-mode={dialog.mode}
        onClick={() => services.workflowDialog.requestOpenUpload()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        {/* Hook trang trí: mặc định không style, không kết xuất; giao diện có thể gắn ảnh qua CSS. */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>

      {showSearch ? (
        <div className="library-bottom-search" role="search">
          <input
            id="library-search-input"
            type="search"
            autoComplete="off"
            placeholder="Tìm sách, tác vụ hoặc ngày"
            aria-label="Tìm sách"
            value={query}
            onChange={onSearchChange}
          />
        </div>
      ) : null}

      <button
        id="app-settings-btn"
        type="button"
        className="library-bottom-icon-btn"
        aria-label="Cài đặt"
        title="Cài đặt"
        aria-controls="app-settings-dialog"
        onClick={() => services.settingsHub.dialogStore.open({ tab: "api" })}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" />
          <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
        </svg>
        {/* Hook trang trí: giống nút thêm, giao diện có thể gắn ảnh qua CSS. */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>
    </div>
  );
}
