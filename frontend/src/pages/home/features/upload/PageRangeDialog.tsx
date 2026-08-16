// Hộp thoại dịch chuyên nghiệp (bản React của <page-range-dialog>, đối chiếu components/dialogs/page-range-dialog.js).
//
// Tầng render Dialog (đợt cuối giai đoạn C, chuyển đổi shadcn): từ <dialog> native + showModal/close
// sang primitive Dialog của radix-ui (DialogPrimitive.Root/Portal/Overlay/Content),
// tiếp tục dùng hệ hình ảnh desktop-dialog/desktop-shell hiện có, không áp giao diện mặc định. Trạng thái đóng/mở
// vẫn là trường pageRangeDialogOpen của uploadView store (nguyên tắc bắt buộc: không sửa store, chỉ thay
// tầng render); onOpenChange(false) luôn ghi lại qua uploadViewActions.patch.
//
// Lỗi thật được sửa kèm (tồn đọng đã ghi từ lâu trong thiết kế và cũng được nhắc ở commit d238471): bấm nền sau
// trước đây kích hoạt uploadFeature.applyPageRanges() (tương đương "xác nhận áp dụng"), còn Escape
// lại đi theo nhánh khác chỉ xóa cờ pageRangeDialogOpen mà không áp dụng; cùng một hộp thoại
// có hai cách đóng với ngữ nghĩa không nhất quán, đồng thời trái quy ước "nền sau/Esc/nút đóng đều chỉ đóng" của tám hộp thoại còn lại.
// Tại đây thống nhất thành ngữ nghĩa chỉ đóng: cả ba cách đóng (bấm nền sau dùng
// phát hiện onPointerDownOutside/outside-click của Radix, Esc, nút đóng DialogPrimitive.Close)
// chỉ patch pageRangeDialogOpen:false, không kích hoạt tác dụng phụ áp dụng nào.
//
// Đã xác nhận không làm mất chức năng: đọc upload/controller.js#applyPageRanges cho thấy toàn bộ
// triển khai chỉ là viewPort.closePageRangeDialog(); hộp thoại này từ lâu không còn trường độc lập kiểu
// "chỉ gửi sau khi xác nhận" (phạm vi trang được đọc/ghi trực tiếp trong input vùng tải lên; lựa chọn bảng thuật ngữ cũng
// ghi trực tiếp store qua <select onChange>; cả hai có hiệu lực tức thì, không qua hộp thoại này để xác nhận).
// Nói cách khác, apply và "chỉ đóng" vốn là cùng một việc trong triển khai hiện tại; thống nhất ngữ nghĩa không làm mất
// bất kỳ đường thao tác nào người dùng có thể truy cập: nút "Hoàn tất" (#page-range-apply-btn) vẫn còn trong hộp thoại,
// và có hiệu quả hoàn toàn giống bấm nền sau/Esc.
//
// Danh sách bảng thuật ngữ do glossaries/selectedGlossaryId trong workflow store điều khiển
// (phản chiếu ngữ nghĩa tùy chọn của setDeveloperGlossaryOptions trong workflow/view.js, gồm
// mục dự phòng "Đã xóa hoặc không khả dụng").
//
// Nút kích hoạt (#page-range-btn trong HeroUpload.jsx) và hộp thoại này nằm ở các cây con khác nhau;
// việc trả focus bằng triggerRef mặc định của Radix không hoạt động, nên tái sử dụng use-dialog-return-focus.js (cùng tiền lệ với tám
// hộp thoại còn lại).

import { Dialog as DialogPrimitive } from "radix-ui";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { useDialogReturnFocus } from "../../../../shared/react/use-dialog-return-focus.js";

export function PageRangeDialog() {
  const services = useHomeServices();
  const upload = useStoreSnapshot(services.stores.uploadView);
  const workflow = useStoreSnapshot(services.stores.workflowView);

  const open = Boolean(upload.pageRangeDialogOpen);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // Esc / bấm nền sau / nút đóng đều ghi lại store qua cùng callback; chỉ đóng và không kích hoạt tác dụng phụ áp dụng.
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.uploadViewActions.patch({ pageRangeDialogOpen: false });
    }
  }

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);

  return (
    <page-range-dialog data-hydrated="1">
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
          <DialogPrimitive.Content
            id="page-range-dialog"
            className="desktop-dialog page-range-dialog professional-translate-dialog"
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <div className="desktop-shell">
              <div className="desktop-head">
                <DialogPrimitive.Title asChild>
                  <h2 id="page-range-title">Dịch nâng cao</h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <button id="page-range-close-btn" type="button" className="dialog-close-btn" aria-label="Đóng">×</button>
                </DialogPrimitive.Close>
              </div>
              <div className="desktop-body">
                <p id="page-range-limit-text" className="muted">Chọn bảng thuật ngữ dùng cho lần dịch này. Có thể nhập trực tiếp phạm vi trang trong khu vực tải lên.</p>
                <label className="professional-glossary-field">
                  <span>Bảng thuật ngữ</span>
                  <select
                    id="job-glossary-id"
                    value={selectedId}
                    onChange={(event) => services.workflowViewActions.setSelectedGlossaryId(event.target.value)}
                  >
                    <option value="">Không dùng bảng thuật ngữ</option>
                    {workflow.glossaries.map((glossary) => (
                      <option key={glossary.glossaryId} value={glossary.glossaryId}>
                        {glossary.name}
                        {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
                      </option>
                    ))}
                    {!hasSelected ? (
                      <option value={selectedId}>{`Đã xóa hoặc không khả dụng: ${selectedId}`}</option>
                    ) : null}
                  </select>
                </label>
                <div className="actions">
                  <button
                    id="page-range-clear-btn"
                    type="button"
                    className="app-button secondary"
                    onClick={() => services.features.uploadFeature?.clearPageRanges()}
                  >
                    Không dùng
                  </button>
                  <button
                    id="page-range-apply-btn"
                    type="button"
                    className="app-button"
                    onClick={() => services.features.uploadFeature?.applyPageRanges()}
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </page-range-dialog>
  );
}
