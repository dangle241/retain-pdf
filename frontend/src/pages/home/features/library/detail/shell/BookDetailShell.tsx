// BookDetailShell —— Book Details弹窗"壳".
//
// 只负责:
//   - Radix Dialog 开合 / 遮罩 / Close钮
//   - 固定 id="book-detail-dialog"(测试与样式锚点)
//   - 双栏布局槽位 left / right
//
// 不负责:
//   - 拉 document, Translation, Delete, Collection等业务
//   - 决定左栏放哪些按钮, 右栏有哪些区块
//
// 用法:
//   <BookDetailShell open={...} onOpenChange={...} left={...} right={...} />

import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(event: Event) => void} [props.onCloseAutoFocus]
 * @param {string} [props.title] None障碍Title(默认"Book Details")
 * @param {import("react").ReactNode} props.left  左栏(封面, 主Action)
 * @param {import("react").ReactNode} props.right 右栏(元Data, Translation, Collection...)
 * @param {string} [props.contentClassName]
 */
export function BookDetailShell({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title = "Book Details",
  left,
  right,
  contentClassName = "",
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="desktop-dialog-overlay" />
        <DialogPrimitive.Content
          id="book-detail-dialog"
          className={`book-detail-dialog-content fixed inset-0 z-[101] m-auto h-fit w-[min(940px,94vw)] max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-paper p-6 shadow-[0_30px_60px_color-mix(in_srgb,var(--shadow-color)_22%,transparent)] sm:p-7 ${contentClassName}`.trim()}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogPrimitive.Title asChild>
            <h2 className="sr-only">{title}</h2>
          </DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <button
              id="book-detail-close-btn"
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ×
            </button>
          </DialogPrimitive.Close>

          <div className="book-detail-shell-grid grid grid-cols-1 gap-7 sm:grid-cols-[236px_1fr]">
            <div className="book-detail-shell-left">{left}</div>
            {/* pr-10: 给右上角Close钮留空, 避免 tab 顶到 × */}
            <div className="book-detail-shell-right min-w-0 space-y-4 pr-10">{right}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}




