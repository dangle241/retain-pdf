// Hook chuyển app-framework/store sang React.
//
// Điểm dễ lỗi (đã kiểm tra): store.getSnapshot() trả clone frozen hoàn toàn mới mỗi lần gọi (tham chiếu không ổn định),
// dùng trực tiếp làm getSnapshot của useSyncExternalStore sẽ gây render lại vô hạn.
// Giải pháp: cache snapshot đi kèm tham số khi subscribe thông báo (notify() chỉ tạo một bản cho mọi listener),
// getSnapshot chỉ đọc cache; lần đọc đầu gọi store.getSnapshot() lười một lần để khởi tạo.
//
// Hỗ trợ selector: cache kết quả selector bằng so sánh nông; snapshot lớn được polling tần suất cao (recent-jobs)
// chỉ kích hoạt component render lại khi lát cắt được chọn thực sự thay đổi.

import { useCallback, useRef, useSyncExternalStore } from "react";

const snapshotCache = new WeakMap();

function cachedSnapshot(store) {
  if (!snapshotCache.has(store)) {
    snapshotCache.set(store, store.getSnapshot());
  }
  return snapshotCache.get(store);
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (!a || !b || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => Object.is(a[key], b[key]));
}

export function useStoreSnapshot(store, selector = null, isEqual = shallowEqual) {
  const selectionRef = useRef({ hasValue: false, value: null });

  const subscribe = useCallback(
    (onStoreChange) => store.subscribe((snapshot) => {
      snapshotCache.set(store, snapshot);
      onStoreChange();
    }),
    [store],
  );

  const getSnapshot = useCallback(() => {
    const snapshot = cachedSnapshot(store);
    if (typeof selector !== "function") {
      return snapshot;
    }
    const next = selector(snapshot);
    const previous = selectionRef.current;
    if (previous.hasValue && isEqual(previous.value, next)) {
      return previous.value;
    }
    selectionRef.current = { hasValue: true, value: next };
    return next;
  }, [store, selector, isEqual]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
