// Hook hoạt ảnh tiến độ theo giai đoạn (thiết kế §2 features/status/, rủi ro §8.1; điểm thời gian dễ
// gây lỗi nhất toàn dự án).
//
// Sao chép từ
// createStatusCardProgressAnimation trong components/status/job-status-card-progress-animation.js (file thuộc danh sách "bị loại và được họ StatusCard.jsx
// thay thế"; cấm import js/components/; buildProgressOptions/
// shouldAnimateRenderPageProgress là VM thuần trong job-status/ nên import nguyên trạng).
//
// Nguyên tắc bắt buộc (rủi ro §8.1): displayedProgressByStage và timer phải dùng useRef, không dùng
// useState; nếu hoạt ảnh nhảy một trang mỗi 120ms dùng useState, mỗi tick sẽ kích hoạt
// render lại toàn bộ component và closure sẽ bắt giá trị state cũ (cập nhật hàm của setState có thể tránh
// vấn đề giá trị closure cũ nhưng vẫn không tránh được render lại mỗi tick; ref là giải pháp duy nhất vừa "duy trì qua các tick
// vừa không kích hoạt render"). Chỉ renderOptions thực sự cần kích hoạt render (được xuất qua
// useState độc lập và giao cho ProgressBlock.jsx render).

import { useEffect, useRef, useState } from "react";
import {
  buildProgressOptions,
  shouldAnimateRenderPageProgress,
} from "../../composition/external.js";

const TICK_DELAY_MS = 120;

export function useStagedProgressAnimation({ selected, selectedIsCurrent, snapshot, selectedProgress, jobId }) {
  const displayedProgressByStageRef = useRef({});
  const timerRef = useRef(null);
  const [renderOptions, setRenderOptions] = useState(null);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function rememberProgress(stageKey, current, total) {
    displayedProgressByStageRef.current[stageKey] = {
      current: Number.isFinite(current) ? current : null,
      total: Number.isFinite(total) ? total : null,
    };
  }

  // Đặt lại khi đổi tác vụ (ngữ nghĩa đi kèm rủi ro §8.1): displayedProgressByStage là "bộ nhớ tiến độ hiển thị
  // xuyên giai đoạn"; sau khi đổi tác vụ phải xóa bộ nhớ của tác vụ cũ, nếu không giai đoạn cùng tên trong tác vụ mới sẽ
  // dùng lại tiến độ hiển thị của tác vụ cũ làm điểm bắt đầu hoạt ảnh.
  useEffect(() => {
    clear();
    displayedProgressByStageRef.current = {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    const previous = displayedProgressByStageRef.current[selected];
    const {
      previousCurrent,
      shouldAnimate,
      targetCurrent,
      targetTotal,
    } = shouldAnimateRenderPageProgress({ selected, selectedIsCurrent, snapshot, selectedProgress, previous });

    if (!shouldAnimate) {
      clear();
      rememberProgress(selected, targetCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({ selected, selectedIsCurrent, snapshot, selectedProgress }));
      return undefined;
    }

    clear();
    let displayedCurrent = previousCurrent;
    const tick = () => {
      displayedCurrent = Math.min(targetCurrent, displayedCurrent + 1);
      rememberProgress(selected, displayedCurrent, targetTotal);
      setRenderOptions(buildProgressOptions({
        selected, selectedIsCurrent, snapshot, selectedProgress, displayedCurrent,
      }));
      if (displayedCurrent < targetCurrent) {
        timerRef.current = setTimeout(tick, TICK_DELAY_MS);
      }
    };
    tick();
    return clear;
    // selected/selectedIsCurrent/snapshot/selectedProgress đều là giá trị dẫn xuất từ props;
    // mỗi khi snapshot thượng nguồn thay đổi, các tham chiếu này tự nhiên thay đổi và danh sách phụ thuộc sẽ chạy lại quyết định hoạt ảnh;
    // thời điểm tương đương việc render({selected,...}) của hệ thống cũ được gọi một lần cho mỗi callback snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedIsCurrent, snapshot, selectedProgress]);

  useEffect(() => clear, []);

  return renderOptions;
}
