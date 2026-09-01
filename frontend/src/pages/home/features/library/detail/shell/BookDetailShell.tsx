// BookDetailShell ââ Book details modal shell.
//
// Responsible for:
//   - Radix Dialog open/close / overlay / Close
//   - Fixed id="book-detail-dialog"(test and style anchor)
//   - Two-column layout slot left / right
//
// Not responsible:
//   - fetch documentTranslation, deletion, collection, and other operations
//   - Define left column buttons and right column sections.
//
// Usage:
//   <BookDetailShell open={…} onOpenChange={…} left={…} right={…} />

import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(event: Event) => void} [props.onCloseAutoFocus]
 * @param {string} [props.title] Accessible title (default「Book Details」）
 * @param {import("react").ReactNode} props.left  Left sidebar (cover, primary actions)
 * @param {import("react").ReactNode} props.right Right column (metadata, translation, collection…）
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
            {/* pr-10Close button top-right leave space avoid overlap tab overlap × */}
            <div className="book-detail-shell-right min-w-0 space-y-4 pr-10">{right}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
