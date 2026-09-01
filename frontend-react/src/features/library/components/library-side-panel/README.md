# Library Side Panel component family

## Boundary

`library-side-panel` Responsible for the collapsible feature entry on the left side of the homepage. It only displays the entry and a lightweight operation panel; actual actions are delegated to the page container via callbacks.

## Files

- `library-side-panel.tsx`Expand/Collapse composite layer.
- `library-side-panel-trigger.tsx`Small button for collapsed state.
- `library-side-panel-item.tsx`Expanded single function item with active state and click callback.
- library-side-panel-config.ts: layout class.
- `library-side-panel-types.ts`Component family type.
- `index.ts`Public egress.

## Rules

- Feature copy and icon list from `library-config.ts`。
- Real functionality passed via callback, not in item Request directly in component. API。
- Multi-select mode displays selection count and batch action buttons here only; selection set is managed by the page container.
