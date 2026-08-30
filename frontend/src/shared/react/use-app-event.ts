// Hook chuyển APP_EVENTS (CustomEvent trên document) sang React.
//
// Theo kế hoạch tổng: giữ nguyên 16 sự kiện retainpdf:*, không nhân dịp này thay đổi cách giao tiếp;
// component React dùng sự kiện qua hook này thống nhất, không tự viết mẫu addEventListener.
//
// handler dùng ref: phía gọi có thể truyền arrow function inline (tham chiếu mới mỗi lần render),
// bản thân đăng ký chỉ tạo lại khi eventName/target thay đổi, không hủy/gắn lại lặp do tham chiếu handler trôi
// (mất sự kiện trong cửa sổ hủy gắn là rủi ro thật trên trang do polling điều khiển).

import { useEffect, useRef } from "react";

export function useAppEvent(eventName, handler, { target = null } = {}) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) {
      return undefined;
    }
    const eventTarget = target || globalThis.document;
    if (!eventTarget?.addEventListener) {
      return undefined;
    }
    const listener = (event) => handlerRef.current?.(event);
    eventTarget.addEventListener(eventName, listener);
    return () => eventTarget.removeEventListener(eventName, listener);
  }, [eventName, target]);
}
