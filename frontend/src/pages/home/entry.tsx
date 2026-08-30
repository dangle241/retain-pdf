// Entry React trang home (giai đoạn dựng khung 3a).
//
// index.html hiện vẫn trỏ tới dist/app.bundle.js cũ; entry này chỉ được tải qua trang phát triển tạm
// home-react-dev.html (dist/home-react-dev.bundle.js) để đối chiếu hai luồng.
// Khi cutover sau 3b, index.html đổi sang dist/home.bundle.js trỏ tới tệp này.
//
// Đảm bảo thứ tự (bản thiết kế §4): tạo composition trước, bind bridge sự kiện trước, ghi view idle vào store trước,
// rồi createRoot().render; useSyncExternalStore nhận giá trị hiện tại ngay lần đọc đầu, không nháy khung rỗng.
// Nhất quán với detail/reader: không bật StrictMode vì composition có binding sự kiện một lần,
// gọi kép sẽ dispatch lặp; tách phần mệnh lệnh dùng lại khỏi StrictMode là quy ước chung của ba trang).

import { createRoot } from "react-dom/client";
import { bootTheme } from "../../shared/theme/theme.js";
import { DecorStage } from "../../shared/decor/DecorStage.jsx";
import { createHomeComposition } from "./composition.js";
import { HomeApp } from "./HomeApp.jsx";

// Gắn data-theme sớm để giảm FOUC khi đổi giao diện (xem docs/theme-system/THEME_SYSTEM.md).
bootTheme();

// appUpdateAutoCheckEnabled: true; composition.js mặc định tắt kiểm tra nền của app-update
// trên GitHub để cô lập test (xem chú thích đầu composition.js); entry production bật rõ tại đây,
// tương đương hành vi port isAppUpdateEnabled của bootstrap/core-app-update-runtime-port.js cũ.
// Hành vi port tương đương.
const services = createHomeComposition({ appUpdateAutoCheckEnabled: true });
services.initialize();

function resolveHomeRoot(body = document.body) {
  let host = document.getElementById("home-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "home-root";
    body.appendChild(host);
  }
  return host;
}

createRoot(resolveHomeRoot()).render(
  <>
    {/* Sân khấu trang trí: theme không có decorPack kết xuất null với chi phí bằng 0 (docs/theme-system/DECOR_PACKS.md). */}
    <DecorStage />
    <HomeApp services={services} />
  </>,
);
