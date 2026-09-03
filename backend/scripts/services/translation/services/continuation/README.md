# Continuation Subpackage description

This subpackage contains paragraph continuity logic, i.e., determining which... OCR blocks should be combined into the same translation unit.

## Division of labor

- `rules.py`
  Text start and end characteristics,bbox Geometric Relations,join/break scoring.
- `state.py`
First consume provider hint, then write rule results back to payload, maintain continuation group and candidate markers.
- `pairs.py`
  Export candidates pairand after approval join Write back.
- `review.py`
  Candidate pair Send to model for review.

## Current strategy

Current continuation adopts provider-first, but not provider-only:

- If payload Included `ocr_continuation_*` Field, same page. `intra_page` provider hint，`state.py` Prioritize direct group creation.
- If cross-page `cross_page` provider hint currently only in "two adjacent pages" + unique reading_order + layout_zone hits page end/start reading boundary + controlled consumption when text length sufficient.
- These items marked as provider_joined, subsequent rules will not re-consume
- Not available provider hint Part continues local-rule concatenation.
- Controlled condition not met `cross_page` provider hint Will remain in payload inside, but will not directly drive concatenation.
- Rule scanning must not fail due to missing intermediate pages (payload page_idx segmentation fault. pair_join_score still only allows adjacent page_idx direct join)
- Two-column L→R Priority Letter `layout_zone`narrow column gap (&lt;8ptalso allowed bbox Judgment
- If latter paragraph like chapter-number heading (e.g. `2.2.1 Title`), hard breakAvoid incomplete sentences. Start new paragraph.

The purpose of this is clear:

- New, already stitched with page. OCR Model, no further local-rule re-guessing.
- For models not yet supporting concatenation, continue reusing existing rules.
- If a new model that can reliably provide cross-page continuous groups appears later, only extension is needed. hint Consumption strategy not required. provider Inject private structures into translation mainline.

## External API

```python
from services.translation.services.continuation import annotate_continuation_context
from services.translation.services.continuation import candidate_continuation_pairs
```
