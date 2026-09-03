// BookDetailShell — the Book Details dialog "shell".
//
// Only responsible for:
//   - Radix Dialog open/close / overlay / close button
//   - Fixed id="book-detail-dialog" (test + style anchor)
//   - Two-column layout slots: left / right
//
// NOT responsible for:
//   - Loading document, translation, delete, collection business logic
//   - Deciding which buttons go in the left column or which sections in the right
//
// Usage:
//   <BookDetailShell open={...} onOpenChange={...} left={...} right={...} />

import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(event: Event) => void} [props.onCloseAutoFocus]
 * @param {string} [props.title] a11y title (default "Book Details")
 * @param {import("react").ReactNode} props.left  left column (cover, primary actions)
 * @param {import("react").ReactNode} props.right right column (metadata, translation, collections, ...)
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
            {/* pr-10: leave room for the top-right close button so tabs don't collide with the × */}
            <div className="book-detail-shell-right min-w-0 space-y-4 pr-10">{right}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}




