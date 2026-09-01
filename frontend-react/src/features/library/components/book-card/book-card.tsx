import { Check, Eye, Trash2 } from 'lucide-react'

import { BookCardMeta } from './book-card-meta'
import { BookCardShell } from './book-card-shell'
import { BookCover } from '../book-cover'
import type { LibraryBook } from '../../types'

type BookCardProps = {
  book: LibraryBook
  selected?: boolean
  selectionMode?: boolean
  selectionChecked?: boolean
  onSelect?: (book: LibraryBook) => void
  onToggleSelect?: (book: LibraryBook) => void
  onOpenReader?: (book: LibraryBook) => void
  onDelete?: (book: LibraryBook) => void
}

export function BookCard({
  book,
  selected = false,
  selectionMode = false,
  selectionChecked = false,
  onSelect,
  onToggleSelect,
  onOpenReader,
  onDelete,
}: BookCardProps) {
  return (
    <article className="grid">
      <BookCardShell selected={selected || selectionChecked} onClick={() => selectionMode ? onToggleSelect?.(book) : onSelect?.(book)}>
        <div className="group/cover relative">
          <BookCover book={book} />
          <div className="pointer-events-none absolute inset-0 z-10 rounded-md bg-neutral-950/0 opacity-0 transition group-hover/cover:bg-neutral-950/18 group-hover/cover:opacity-100" />
          {selectionMode ? (
            <button
              type="button"
              className={[
                'absolute left-2 top-2 z-30 grid size-8 place-items-center rounded-full shadow-lg transition',
                selectionChecked ? 'bg-neutral-950 text-white' : 'bg-white/95 text-neutral-950',
              ].join(' ')}
              aria-label="选择"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onToggleSelect?.(book)
              }}
            >
              {selectionChecked ? <Check className="size-4" /> : null}
            </button>
          ) : null}
          <button
            type="button"
            className="pointer-events-none absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-full bg-white/95 text-neutral-950 opacity-0 shadow-lg transition hover:scale-105 hover:bg-neutral-950 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none group-hover/cover:pointer-events-auto group-hover/cover:opacity-100"
            aria-label="删除"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onDelete?.(book)
            }}
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            className={[
              'pointer-events-none absolute left-1/2 top-1/2 z-20 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-neutral-950 opacity-0 shadow-lg transition hover:scale-105 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none group-hover/cover:pointer-events-auto group-hover/cover:opacity-100',
              selectionMode ? 'hidden' : '',
            ].join(' ')}
            aria-label="对照阅读"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onOpenReader?.(book)
            }}
          >
            <Eye className="size-5" />
          </button>
        </div>
        <BookCardMeta title={book.title} authors={book.authors} />
      </BookCardShell>
    </article>
  )
}
