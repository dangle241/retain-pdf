// Hook tải ảnh bìa thẻ (bản thiết kế §2 features/library/, giảm rủi ro §8.3).
//
// Dùng lại loadFirstRecentJobImage của facade image-loader.js (cache objectURL cấp mô-đun,
// không bao giờ revoke; khi React gỡ **không được** revoke, chỉ vô hiệu qua
// invalidateRecentJobImages và không chạm vòng đời cache tại đây); facade card-presenter.js
// dùng recentJobRawImageUrls để lấy danh sách URL ứng viên.
//
// imageCacheVersionOf được sao chép từ recent-job-card.js:12-29 vì facade không export hàm thuần này;
// theo bản thiết kế sao chép trực tiếp thay vì thêm export. token chống race: khi job đổi hoặc URL ứng viên
// đổi thì tăng token; khi async resolve, chỉ ghi state nếu token vẫn mới nhất để tránh
// ảnh từ yêu cầu cũ ghi đè yêu cầu mới khi tái sử dụng thẻ nhanh.

import { useEffect, useRef, useState } from "react";
import type { LibraryCardItem } from "../types.js";
import {
  loadFirstRecentJobImage,
  recentJobRawImageUrls,
} from "../../../composition/external.js";

// Phiên bản cache chỉ đổi khi "bìa có thể thật sự đổi". Bìa được backend /jobs/{id}/cover kết xuất
// (đang chạy = trang đầu PDF gốc; chỉ sau hoàn tất mới có thể đổi sang bìa đầu ra); trong lúc chạy nội dung bìa
// không đổi. Cách cũ đưa updated_at + progress.current/percent và các trường "đổi mỗi nhịp poll"
// vào phiên bản cache → cache miss mỗi giây → fetch lại blob bìa,
// tạo objectURL mới, đổi src <img> làm nháy và rò một objectURL mỗi nhịp. Đây
// chính là hiện tượng người dùng thấy "thẻ thư viện nhấp nháy khi chạy".
//
// Sửa: khi chưa ở trạng thái cuối, chỉ tính phiên bản theo status (ổn định trong queued/running; tải bìa một lần là đủ, không
// tải lại mỗi nhịp); chỉ tính updated_at ở trạng thái cuối succeeded/failed/canceled, lúc này
// bìa có thể vừa tạo/cập nhật nên cần bust một lần; updated_at cũng phân biệt các run khác nhau vì chạy lại có
// timestamp hoàn tất mới và bìa làm mới, vẫn giữ khả năng "đổi bìa mới sau chạy lại".
const TERMINAL_COVER_STATUSES = new Set(["succeeded", "failed", "canceled", "cancelled"]);

function imageCacheVersionOf(item: LibraryCardItem = {}) {
  const status = `${item.status || ""}`.trim();
  if (TERMINAL_COVER_STATUSES.has(status)) {
    return `${status}|${item.updated_at ?? ""}`;
  }
  return status;
}

export function useRecentJobCover(item?: LibraryCardItem | null) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const safeItem = item || {};

  const rawUrls = recentJobRawImageUrls(safeItem);
  const cacheVersion = imageCacheVersionOf(safeItem);
  const rawUrlsKey = rawUrls.join("|");

  useEffect(() => {
    const token = (tokenRef.current += 1);
    if (rawUrls.length === 0) {
      setCoverUrl(null);
      return undefined;
    }
    let cancelled = false;
    loadFirstRecentJobImage(rawUrls, { cacheVersion })
      .then((url) => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(url || null);
      })
      .catch(() => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // rawUrlsKey/cacheVersion là dạng primitive của rawUrls/cacheVersion, dùng làm
    // phụ thuộc effect; mảng/đối tượng có tham chiếu mới mỗi lần kết xuất nên không đưa trực tiếp vào deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlsKey, cacheVersion]);

  return coverUrl;
}
