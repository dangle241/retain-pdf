// 左栏：封面 + 对照/原版主操作。
// 元信息摘要（页数/大小/入库/合集）已迁到右栏简介 Tab 的信息网格
// （BookDetailOverviewTab）——左栏纯粹化，右栏不再空旷。

import { btn, IconCompare, IconEye } from "./ui.jsx";
import { BookCardProcessingOverlay } from "../../display/BookCardProcessingOverlay.jsx";

/**
 * @param {object} props
 * @param {string} props.coverUrl
 * @param {boolean} props.readerAvailable
 * @param {string} props.documentId
 * @param {string|boolean} props.busy
 * @param {boolean} [props.processing] 翻译/重试进行中：封面中央 loading
 * @param {() => void} props.onCompare
 * @param {() => void} props.onReadSource
 */
export function CoverActionsPanel({
  coverUrl,
  readerAvailable,
  documentId,
  busy,
  processing = false,
  onCompare,
  onReadSource,
}) {
  return (
    <div className="sticky top-0 space-y-3">
      <div
        className="relative mx-auto flex aspect-[3/4] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted bg-cover bg-center shadow-[0_10px_26px_color-mix(in_srgb,var(--shadow-color)_14%,transparent)] sm:mx-0 sm:max-w-none"
        style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
        data-cover-processing={processing ? "true" : "false"}
      >
        {coverUrl ? null : <span className="text-xs text-muted-foreground">无封面</span>}
        {processing ? <BookCardProcessingOverlay /> : null}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {readerAvailable ? (
          <button
            id="book-detail-compare-btn"
            className={btn("default", "w-full")}
            disabled={Boolean(busy)}
            onClick={onCompare}
          >
            <IconCompare className="mr-1" />
            对照阅读
          </button>
        ) : null}
        <button
          id="book-detail-read-source-btn"
          className={btn(readerAvailable ? "outline" : "default", "w-full")}
          disabled={Boolean(busy) || !documentId}
          onClick={onReadSource}
        >
          <IconEye className="mr-1" />
          查看原版
        </button>
      </div>
    </div>
  );
}
