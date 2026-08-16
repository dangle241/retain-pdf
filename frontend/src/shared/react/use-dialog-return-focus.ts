// Bù trả focus sau khi Radix Dialog đóng (giai đoạn C: chuyển đổi shadcn, thay tầng render dialog).
//
// Cơ chế mặc định của Radix "trả focus về phần tử kích hoạt sau khi đóng" phụ thuộc DialogPrimitive.Trigger ghi lại
// context.triggerRef; nhưng cả chín hộp thoại của dự án đều không theo cách dùng kinh điển "Trigger và Content cùng
// cây con": không nơi nào render DialogPrimitive.Trigger (nút kích hoạt đều là
// <button onClick={...}> thông thường, nằm rải ở panel HeroUpload/SettingsHubDialog/
// AppShellHeader/thẻ kích hoạt EventsTimeline và các component hoàn toàn khác; trạng thái được điều khiển qua
// dialogStore.open()/APP_EVENTS/useState cục bộ), Radix không biết "ai
// đã mở tôi", vì vậy onCloseAutoFocus mặc định (cố focus triggerRef.current)
// luôn là no-op; kiểm tra thực tế cho thấy sau khi đóng, focus rơi vào <body>, không trở về nút người dùng vừa bấm
// . Nguyên nhân gốc không liên quan việc "nút kích hoạt có cùng cây con React với Content hay không" (dù cùng cây,
// chỉ cần không dùng DialogPrimitive.Trigger thì vẫn no-op), nên cả chín hộp thoại trong dự án
// đều cần hook này, không chọn dùng theo "có xuyên cây con hay không".
//
// Tại đây bổ sung thủ công ngữ nghĩa tương đương: khi open chuyển false → true, ghi lại
// document.activeElement lúc đó (gần như luôn là nút kích hoạt người dùng vừa bấm); khi hộp thoại đóng,
// onCloseAutoFocus của DialogPrimitive.Content trả focus về đó và
// preventDefault hành vi mặc định của Radix.
//
// File này ban đầu nằm dưới src/pages/home/state/ (bốn đợt hộp thoại đầu giai đoạn C đều ở trang home);
// sau khi đợt cuối giai đoạn C chuyển hai modal EventsTimeline của trang detail sang Radix Dialog,
// hook này trở thành phần dùng chung xuyên trang (cả home.bundle.js + detail.bundle.js đều cần bundle),
// nên chuyển tới src/shared/react/ cùng cấp với use-app-event.js/use-store.js/DownloadToastHost.jsx
// (các file sau cũng là tiền lệ "nhiều trang tự bundle bằng esbuild nhưng dùng chung một mã nguồn").

import { useEffect, useRef } from "react";

export function useDialogReturnFocus(open) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
    }
  }, [open]);

  function onCloseAutoFocus(event) {
    event.preventDefault();
    const target = previouslyFocusedRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    }
  }

  return { onCloseAutoFocus };
}
