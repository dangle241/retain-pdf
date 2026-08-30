// Vùng điều hướng trên bỏ nền thẻ trắng: logo sát trái, các tab "Thư viện/Bộ sưu tập/Đã lưu/AI" ở giữa,
// nổi trực tiếp trên nền xám. Thêm/tìm kiếm/cài đặt chuyển xuống một thanh nổi ở đáy.
// (AppBottomBar.jsx)。
//
// Cách căn giữa: logo bên trái, spacer flex:1 hai bên đẩy tab vào giữa. #developer-btn/
// #open-output-btn là id hợp đồng dùng trong test; giữ trong container display:none và không chiếm bố cục.

import { LibraryTopTabs } from "../library/page/LibraryTopTabs.jsx";

export function AppTopBar({ activeTab, onTabChange }) {
  return (
    <app-shell-header class="app-shell-header">
      <header className="topbar library-topbar">
        <a
          className="hero-repo-link library-brand-link"
          href="https://github.com/wxyhgk/retain-pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className="hero-repo-logo" src="src/assets/RetainPDF-logo.svg" alt="RetainPDF logo" />
          <span>RetainPDF</span>
        </a>
        <div className="hero-actions hidden" aria-hidden="true">
          <button id="developer-btn" type="button" className="secondary hidden" aria-hidden="true">Nhà phát triển</button>
          <button id="open-output-btn" type="button" className="secondary hidden">Mở thư mục đầu ra</button>
        </div>
        <div className="library-topbar-spacer" aria-hidden="true" />
        <LibraryTopTabs active={activeTab} onChange={onTabChange} />
        <div className="library-topbar-spacer" aria-hidden="true" />
      </header>
    </app-shell-header>
  );
}
