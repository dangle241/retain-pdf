// Gốc điều phối React của trang home.
//
// Cấu trúc đối chiếu partials/main-content.html + dialogs.html và phản chiếu từng khối; phía trên chỉ giữ
// thương hiệu + cột Thư viện/Phân loại (AppTopBar.jsx, bỏ nền thẻ trắng); ba mục Thêm/Tìm kiếm/Cài đặt
// được gom vào một thanh nổi giữa đáy (AppBottomBar.jsx, thay cho hai vùng nổi tách rời trước đây AppBottomActions +
// LibrarySearchDock).
// Các khối còn lại (lưới library-view, thẻ status, credentials/glossaries/status-detail, v.v.)
// đã lần lượt được nối; ReaderDialog chỉ điều hướng tới reader.html (không có UI).
// Các thẻ custom element placeholder (<recent-jobs-dialog>, v.v.) không đăng ký định nghĩa trong hệ thống mới, nên trơ và không có tác dụng phụ.

import { useState } from "react";
import { HomeServicesProvider } from "./home-services-context.js";
import type { HomeServices } from "./composition/types.js";
import { AppTopBar } from "./features/app-shell/AppTopBar.jsx";
import { AppBottomBar } from "./features/app-shell/AppBottomBar.jsx";
import { MockModeBanner } from "./features/app-shell/MockModeBanner.jsx";
import { TranslationWorkflowDialog } from "./features/workflow/TranslationWorkflowDialog.jsx";
import { PageRangeDialog } from "./features/upload/PageRangeDialog.jsx";
import {
  RecentJobsLibrary,
  CategoriesView,
  FavoritesView,
  BookDetailDialog,
} from "./features/library/index.js";
import { HomeAskView } from "./features/home-ask/HomeAskView.js";
import { CredentialsDialog } from "./features/credentials/CredentialsDialog.jsx";
import { GlossariesDialog } from "./features/glossaries/GlossariesDialog.jsx";
import { SettingsHubDialog } from "./features/settings/SettingsHubDialog.jsx";
import { StatusDetailDialog } from "./features/status-detail/StatusDetailDialog.jsx";
import { ReaderDialog } from "./features/reader/ReaderDialog.jsx";
import { SoftReaderHost } from "./features/reader/SoftReaderHost.jsx";
import { CollectionManageDialog } from "./features/collections/CollectionManageDialog.jsx";
import { DownloadToastHost } from "../../shared/react/DownloadToastHost.jsx";
import {
  readInitialLibraryTabFromReturn,
  useHomeReturnRestore,
} from "./features/library/page/useHomeReturnRestore.js";
// Điểm đăng ký duy nhất của custom element library-search-island. Hệ thống cũ dùng side-effect import trong src/js/components/index.js
// làm dự phòng để đăng ký; khi file đó bị xóa sau cutover, chuỗi đăng ký bị đứt sẽ khiến
// thẻ <library-search-island> trong JSX bên dưới render thành thẻ trống trơ (vẫn tồn tại theo hợp đồng dữ liệu nhưng chức năng tìm kiếm
// âm thầm hỏng; chỉ render trên trình duyệt thật mới thấy, jsdom không báo lỗi). Tại đây tiếp quản đăng ký một cách tường minh.
import "../../js/islands/library-search/index.js";

function HomeShell() {
  // Khi quay lại từ trình đọc, cố gắng khôi phục tab trước khi rời đi; nếu không thì mặc định là Thư viện.
  const [activeLibraryTab, setActiveLibraryTab] = useState(readInitialLibraryTabFromReturn);
  const isLibraryTab = activeLibraryTab === "library";
  const isCategoriesTab = activeLibraryTab === "categories";
  const isFavoritesTab = activeLibraryTab === "favorites";
  const isAskTab = activeLibraryTab === "ask";
  // Cả thanh công cụ chọn hàng loạt #31 và thanh dưới đều cố định giữa đáy; trong chế độ hàng loạt, thanh dưới được CSS
  // ẩn (không unmount; unmount input tìm kiếm sẽ làm tham chiếu library-search-island mất hiệu lực) để nhường chỗ
  // cho thanh công cụ hàng loạt; hai thanh không hiển thị cùng lúc.
  const [batchModeActive, setBatchModeActive] = useState(false);

  // Tab Bộ sưu tập/Đã lưu/AI: thử khôi phục vị trí cuộn panel ngay khi view mount (Thư viện do RecentJobsLibrary khôi phục sau khi có danh sách).
  useHomeReturnRestore(isCategoriesTab || isFavoritesTab || isAskTab);

  return (
    <>
      <main id="app-shell" className="page app-shell" data-home-spa="">
        <AppTopBar activeTab={activeLibraryTab} onTabChange={setActiveLibraryTab} />
        <MockModeBanner />
        {/* Sân khấu Paper Heart: phân cấp chất liệu/tỷ lệ (không phải ghép biểu tượng truyền thống); tạm thời chưa làm bộ lọc thanh bên. */}
        <div className="home-paper-stage">
          {isLibraryTab ? (
            <>
              <RecentJobsLibrary {...({ onBatchModeChange: setBatchModeActive } as any)} />
              <AppBottomBar showSearch hidden={batchModeActive} />
              <library-search-island></library-search-island>
            </>
          ) : isCategoriesTab ? (
            <>
              <CategoriesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isFavoritesTab ? (
            <>
              <FavoritesView />
              <AppBottomBar showSearch={false} />
            </>
          ) : isAskTab ? (
            // Hội thoại AI không gắn thanh nổi "Tải lên / Cài đặt" ở đáy để tránh che vùng nhập.
            <HomeAskView />
          ) : null}
        </div>
        <button id="open-query-btn" type="button" className="secondary hidden" aria-hidden="true">Tác vụ gần đây</button>
        {/* Placeholder 3b: hộp thoại tác vụ gần đây. */}
        <recent-jobs-dialog></recent-jobs-dialog>
        <SettingsHubDialog />
        <TranslationWorkflowDialog />
      </main>
      {/* Khối dialogs.html: hộp thoại dịch chuyên nghiệp của miền upload + miền credentials đã chuyển sang React, phần còn lại là placeholder (3b). */}
      <CredentialsDialog />
      <GlossariesDialog />
      <developer-auth-dialog></developer-auth-dialog>
      <developer-settings-dialog></developer-settings-dialog>
      <PageRangeDialog />
      <StatusDetailDialog />
      <ReaderDialog />
      {/* Mở mềm trình đọc: lớp toàn màn hình, không unmount trang chủ (đóng × không làm mới). */}
      <SoftReaderHost />
      <CollectionManageDialog />
      <BookDetailDialog />
      <DownloadToastHost />
    </>
  );
}

export function HomeApp({ services }: { services: HomeServices }) {
  return (
    <HomeServicesProvider value={services}>
      <HomeShell />
    </HomeServicesProvider>
  );
}
