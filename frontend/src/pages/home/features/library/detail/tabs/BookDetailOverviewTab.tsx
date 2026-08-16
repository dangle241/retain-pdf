// Tab "Giới thiệu sách": tiêu đề / tác giả / nhãn / sửa + lưới siêu dữ liệu.
// Sửa UI giới thiệu chỉ đổi tệp này hoặc TitleMetaPanel.
// Siêu dữ liệu (số trang/dung lượng/ngày thêm/bộ sưu tập) chuyển từ cột trái: cột phải bớt trống, cột trái chỉ còn bìa + thao tác chính.

import { IconLayers } from "../panels/ui.jsx";
import { TitleMetaPanel } from "../panels/TitleMetaPanel.jsx";
import type { ComponentProps, ReactNode } from "react";

type BookDetailOverviewTabProps = ComponentProps<typeof TitleMetaPanel> & {
  pageCount?: number | string | null;
  bytes?: number | string | null;
  addedAt?: string | null;
  memberCollections?: string[];
};

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * @param {object} props Props nghiệp vụ TitleMetaPanel + siêu dữ liệu (pageCount/bytes/addedAt/memberCollections).
 */
export function BookDetailOverviewTab({
  pageCount,
  bytes,
  addedAt,
  memberCollections = [],
  ...titleMetaProps
}: BookDetailOverviewTabProps) {
  const sizeText = formatBytes(bytes);
  const dateText = formatDate(addedAt);
  return (
    <div
      className="book-detail-tab-overview space-y-5"
      data-book-detail-tab="overview"
    >
      <TitleMetaPanel {...titleMetaProps} />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border/60 p-4 sm:grid-cols-4">
        <MetaCell label="Số trang">{pageCount ? `${pageCount} trang` : "—"}</MetaCell>
        <MetaCell label="Dung lượng">{sizeText || "—"}</MetaCell>
        <MetaCell label="Đã thêm vào thư viện">{dateText || "—"}</MetaCell>
        <MetaCell label="Bộ sưu tập">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <IconLayers className="shrink-0 text-muted-foreground" />
            <span className="truncate">
              {memberCollections.length ? memberCollections.join("、") : "Chưa thêm"}
            </span>
          </span>
        </MetaCell>
      </dl>
    </div>
  );
}
