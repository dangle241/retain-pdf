# Library Model

`model` Place library page state and action orchestration.

- `useLibraryController` Handles list loading, detail caching, download, delete, filtering, sorting, dialog toggle, and multi-select state.
- `useLibraryData` Responsible for list loading, detail caching, current book, and local list removal.
- `useLibraryFeedback` Responsible for unified writing toast。
- Components do not directly call the backend or read data. mock data。
- Backend response still passes through first: api adapter converts to LibraryBook, then enters the page state.

If continues growing, split further by responsibility. `use-library-selection`、`use-library-downloads`Don't put logic back into components.
