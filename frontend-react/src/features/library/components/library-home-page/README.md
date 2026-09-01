# Library Home Page component family

## Boundary

`library-home-page` Handles page-level layout for the library homepage. Composes top bar, filter toolbar, and book grid; does not own data requests, modal state, or backend. API。

## Files

- `library-home-page.tsx`Homepage composition layer.
- `index.ts`Public exports for component family.

## Rules

- Page state is passed in by the parent container.
- Product copy and sorting items sourced from `library-config.ts`。
- Subsequent search, filtering, and upload entry points can be further split into independent areas within this component family.
