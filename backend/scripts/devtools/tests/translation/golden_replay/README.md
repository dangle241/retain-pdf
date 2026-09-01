# Translation Replay Golden Cases

This directory contains only the reproducible translation regression sample list and redacted data. fixtureDo not use real data. API key。

## Purpose

- Reproduce model response protocol shell./JSON Shell.
- Reproduce empty translation fallback.
- Untranslated English remnants reappear.
- Reproduce mistranslation or accidental skipping of technical blocks.

## How to run

Prefer existing tools.

```bash
python3 backend/scripts/devtools/replay_translation_item.py --case <case-json>
```

If the sample is from real data. job, first use promptfoo capture Save desensitized tool as case artifactThen add this directory. manifestDo not commit in this directory. `sk-*`、PaddleOCR tokenFull user file or unredacted. job Data.

## File conventions

- `manifest.json` Sample index.
- `cases/*.json` Store desensitized orders item replay Input.
- Each case requires `id`, `category`, `expected`, `fixture` or `source_artifact`.
