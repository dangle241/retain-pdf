# Retain Integration recommendations

Based on current `doc/reference/LLM_api/DeepSeek` directory documentation, and official latest model specification; most directly valuable capabilities for current project are as follows.

## 1. Default model

- Default model should be switched to `deepseek-v4-flash`
- `deepseek-chat` / `deepseek-reasoner` Still compatible, but marked for deprecation; not for new defaults.

## 2. Project's most direct, useful capability.

- `JSON Output`
  Applicable to our current translation classification, failure diagnosis, and structured response scenarios.
- `1M context`
  Useful for long documents, long-context rules, and glossary scenarios.
- `Context Cache / KV Cache`
  Duplicate system promptBatch translation cost optimization for long rules and long term glossaries: high value.
- `Tool Calls`
  Currently not required for main flow, but potentially valuable for failure diagnosis, rule selection, external term lookup.
- Error codes
  401 / 402 / 422 / 429 / 500 / 503 Worth mapping into our existing failure classification and retry policy.

## 3. Prioritize backend tasks.

- Set default model to `deepseek-v4-flash`
- Keep `response_format={\"type\":\"json_object\"}` structured return capability.
- Strengthen retry backoff for DeepSeek 429 / 503
- Evaluate length system promptRule text, glossary integration. context cache
- Do not add `deepseek-chat` to new examples, defaults, and debugging tools.

## 4. Related docs

- [Models & Pricing](./Models%20%26%20Pricing.md)
- [JSON_output](./JSON_output.md)
- [Tool Calls](./Tool%20Calls.md)
- [Error Codes](./éè¯¯ç .md)
- [Token usage calculation](./Token%20Usage%20Calculation.md)
