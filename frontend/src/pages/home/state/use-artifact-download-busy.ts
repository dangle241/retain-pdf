// artifact-download-busy-store.js → hook đăng ký React, lấy lát cắt theo actionId
// (cơ chế cốt lõi của phương án hai trong thiết kế §7.5). getSnapshot được cache bằng useCallback, chỉ đổi identity hàm khi
// store/actionId thay đổi; store.getActionState(actionId) trả về cùng tham chiếu đối tượng khi
// actionId đó không thay đổi (hằng số IDLE hoặc lát cắt busy chưa sửa),
// kết hợp useSyncExternalStore để "chỉ render lại khi actionId của chính nó thay đổi",
// không bị ghi đè hay chớp theo render lại do polling tần suất cao của tổ tiên (StatusCard/StatusDetailDialog).

import { useCallback, useSyncExternalStore } from "react";
import type { ArtifactBusySlice, ArtifactDownloadBusyStore } from "./artifact-download-busy-store.js";

export function useArtifactDownloadBusy(
  store: ArtifactDownloadBusyStore,
  actionId: string,
): ArtifactBusySlice {
  const getSnapshot = useCallback(() => store.getActionState(actionId), [store, actionId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
