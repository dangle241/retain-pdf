# Config Layer description

`scripts/foundation/config` Centralizes configuration management, preventing the shared layer from continuing to bear all responsibilities.

## Split results

- `paths.py`
  Only include path-related configuration, e.g. `ROOT_DIR`、`DATA_DIR`、`OUTPUT_DIR`、`SOURCE_PDF`。
- `fonts.py`
  Only include font and font size settings, e.g., default font path, default font size.Typst Default font family.
- `runtime.py`
Only include runtime defaults, e.g., default page number, default output name, PDF compression DPI.
- `layout.py`
  Only include layout tuning-related configurations, and `apply_layout_tuning(...)`。

## Compatibility strategy

Currently retained `scripts/foundation/shared/config.py` Compatibility facade。

Common legacy patterns:

```python
from foundation.config.paths import OUTPUT_DIR
from foundation.config.layout import apply_layout_tuning
```

If later you want to gradually decouple, you can then further each module's import Migrate to clearer sources:

- Prefer path-related `foundation.config.paths`
- Use font-related first. `foundation.config.fonts`
- Prioritize layout parameter tuning. `foundation.config.layout`
- Use runtime defaults first. `foundation.config.runtime`
