# Library Route

`LibraryRoute` Composite container for the library page.

- Only responsible for connecting useLibraryController status and actions to pages, details, reader, and settings popups.
- Filtering download deletion backend requests business logic omit.
- No specific context provided. UI Copy; still passes. `library-config.ts`。
- Reader statically integrated; no extra component package loaded when opening side-by-side reading.

This boundary enables `App.tsx` Keep entry responsibilities; prevent page-level state from entering pure presentation components.
