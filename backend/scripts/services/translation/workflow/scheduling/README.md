# Dispatch

This directory handles translation units Execution mechanism after selection.

- Queue Assignment
- Worker pool lifecycle
- Result Queue drain
- tail retry pass
- flush Rhythm
- Scheduling Metrics

It should not decide a particular block whether to translate, should not construct prompt, nor should it implement provider HTTP Call.

Current source files to be migrated:

- `workflow/batch_runner.py`
- `workflow/workers.py`
- `workflow/batching/pending_units.py` Parts related to Li and scheduling.
