# 04 Continuation Hint

## Goal

If Paddle already knows which blocks are in the same paragraph, the adapter should map such info to a unified contract:

- `continuation_hint`

Don't let the translation layer directly read Paddle's group_id, global_group_id, or block_order.

## Current fields

Current structure of continuation_hint:

```json
{
  "source": "provider",
  "group_id": "provider-paddle-global-xxx",
  "role": "head",
  "scope": "cross_page",
  "reading_order": 0,
  "confidence": 0.98
}
```

Field description:

- `source`
Current provider writes provider as a fixed value
- `group_id`
  Continuous Group Stability id
- `role`
  `single/head/middle/tail`
- `scope`
intra_page or cross_page
- `reading_order`
  Order within group
- `confidence`
  provider Confidence for this group

## Current Paddle mapping rules

Current code is at:

- `backend/scripts/services/document_schema/provider_adapters/paddle/continuation.py`

Current rules:

1. Prioritize `raw_global_group_id`
2. Fall back if no global group. `page_index + raw_group_id`
3. If a multi-block group is not reliable from raw_block_order, do not generate continuation hint
4. Mark as same-page group `intra_page`
5. Mark as cross-page group `cross_page`

## Downstream consumption contract

Translation currently adopts provider-first:

1. Same page `intra_page` hint Prioritize direct consumption
2. Cross-page cross_page hint is consumed only under controlled conditions when security requirements are met.
3. Security warning: action blocked.hint Will be retained, but will not directly trigger concatenation.

That is to say:

- adapter Responsible for "accurate expression" provider Known things
- translation Responsible for deciding when to safely trust provider”

## Notes for adapters

1. `group_id` Only require stability within the group, not invariance across versions forever.
2. `reading_order` Must be unique and monotonically increasing within the group.
3. If Paddle's group info is unstable for a certain version, omit continuation_hint and don't write incorrect data.
4. Don't fake cross-page continuity just to make an example pass.
