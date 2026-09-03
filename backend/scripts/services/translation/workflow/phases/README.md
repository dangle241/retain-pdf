# Translation phase

This directory is for implementing the full-book translation phase.

Plan split:

- `continuation.py`
  Initial contiguous segment consolidation, and provider Auxiliary Hurdle/Cross-page continuous paragraph review.
- `policy.py`
  Page strategy and block classification stage.
- `batch_translation.py`
  Batch translation phase adapter layer. It should call scheduling Write code, do not manage queue details yourself.
- `repair.py`
  Garbled rebuild.agent Fix and finalize untranslated items.
- `events.py`
  If event format continues to grow, stable stage events. helper Place here.

Do not place provider HTTP client, render prewarm, or page file discovery logic here.
