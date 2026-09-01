# Library Settings Dialog component family

## Boundary

`library-settings-dialog` Library homepage settings popup. Currently only placeholder for sections. No direct read write. Remove popup. API、localStorage or global state.

## Files

- library-settings-dialog.tsx: popup composition layer.
- `library-settings-config.ts`Layout class And local configuration for component family.
- `library-settings-selectors.ts`Convert configuration to settings view data.
- `library-settings-tabs.tsx`Set partition tab Switch.
- `library-settings-panel.tsx`Single settings partition panel.
- `library-settings-types.ts`Set component family type.
- index.ts: component family public export.

## Rules

- Product copy comes from library-config.ts.
- Subsequent real setting items should first supplement type and view modelthen pass to display component for rendering.
- Don't move backend logic to frontend. API Fields written directly into presentation components.
