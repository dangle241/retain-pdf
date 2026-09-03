# Book Grid component family

## Boundary

`book-grid` Responsible for grid layout of book collection. It only receives already prepared. `books`Does not handle search, sort, filter, or data requests.

## Files

- `book-grid.tsx`Render scroll container and book card grid.
- index.ts: public export for the component family.

## Rules

- External only import BookGrid.
- Selection is passed via selectedBookId.
- Click behavior passed `onSelectBook` Leave handling to the page or container.
- Empty states, loading states, and batch selection toolbar: place in this directory later.
