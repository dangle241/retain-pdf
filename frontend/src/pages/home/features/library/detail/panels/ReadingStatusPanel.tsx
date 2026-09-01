// Right column: Read status (unread / reading / Finished).

import { cn } from "@/lib/utils";

export const READING_STATUSES = [
  { value: "unread", label: "未读" },
  { value: "reading", label: "在读" },
  { value: "done", label: "读完" },
];

/**
 * @param {object} props
 * @param {string} props.value
 * @param {string} props.busy
 * @param {(value: string) => void} props.onChange
 */
export function ReadingStatusPanel({ value, busy, onChange }) {
  return (
    <div className="space-y-1.5 border-t border-border/30 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">reading status</p>
<div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="Reading Status">
        {READING_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={busy === "reading"}
            onClick={() => onChange(s.value)}
            className={cn(
              "book-detail-reading-btn border-r border-border px-4 py-1.5 text-xs last:border-r-0 disabled:opacity-60",
              value === s.value
                ? "is-active bg-primary text-primary-foreground"
                : "bg-paper text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
