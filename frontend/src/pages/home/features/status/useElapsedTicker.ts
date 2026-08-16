// Hook đồng hồ bấm giờ (thiết kế §2 features/status/, §3.5).
//
// Được điều khiển độc lập với statusCardStore (cố ý không đưa elapsed vào store; xem
// comment đầu status-card-store.js). Tick 1 giây, dừng ở trạng thái cuối (succeeded/failed/canceled)
// và tái sử dụng trực tiếp hàm thuần trong job/elapsed-view-model.js.

import { useEffect, useState } from "react";
import {
  buildElapsedViewModel,
  isTerminalStatus,
} from "../../composition/external.js";

export function useElapsedTicker(job, { finishedAtFallback = "" } = {}) {
  const [tick, setTick] = useState(0);

  const status = `${job?.status || ""}`.trim();
  const terminal = isTerminalStatus(status);

  useEffect(() => {
    if (terminal || !job) {
      return undefined;
    }
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [terminal, job?.job_id, status]);

  void tick; // Chỉ dùng để kích hoạt render lại mỗi giây; bản thân giá trị không tham gia tính toán.
  return buildElapsedViewModel(job, { finishedAtFallback });
}
