# Book Card Component family

## Boundary

`book-card` Responsible for the single book card on the library homepage. It is a component family; external code should import from `./book-card` Entry import. Do not directly depend on internal files.

## Files

- `book-card.tsx`Composition layer, `LibraryBook` Convert to card section requirements. props。
- `book-card-shell.tsx`Clickable shell,hover Effects and selected state.
- `book-card-meta.tsx`Title and author area layout.
- `book-status-badge.tsx`: Legacy status badge component; the current card does not show status, kept for potential future use in list density mode.
- `index.ts`Common export for component family.

## Rules

- Product copy and status definitions go in `library-config.ts`。
- Place data structure definitions in `types.ts`。
- Place all book card display capabilities in this directory going forward.
- External import only `BookCard`Internal widgets not exposed by default.
- Click the card body to view details
- hover Eye button at cover center. Click for side-by-side reading.
- hover Delete button appears in upper-right corner of cover. Clicking Delete triggers only the delete callback; does not open details.
