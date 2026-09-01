

# 1. Recommended overall architecture

Do not translate by page. Do not press bare. block Recommended translation unit, TU as minimum translation unit.

But the TU here TU Input not recognized. Provide source text for translation. OCR blockIt must be a structured object with constraints.

```json
{
  "tu_id": "p0123_b0045_u0002",
  "page_idx": 123,
  "block_ids": ["b0045"],
  "source_text": "...",
  "protected_spans": [...],
  "layout_anchor": {
    "bbox": [...],
    "reading_order": 45,
    "block_kind": "text",
    "layout_role": "body"
  },
  "context": {
    "prev_summary": "...",
    "next_hint": "...",
    "section_title": "..."
  },
  "constraints": {
    "must_terms": [...],
    "placeholders": [...]
  }
}
```

Recommended pipeline change to:

```
OCR normalized JSON
→ layout graph construction
→ block cleanup / formula / placeholder protection
→ TU segmentation
→ continuation candidate detection
→ glossary / memory retrieval
→ immutable context snapshot
→ scheduling / batching
→ LLM structured translation
→ deterministic validator
→ targeted retry
→ targeted repair
→ second validator
→ degraded export decision
→ diagnostics / manifest
```

Three key changes:

1. **Create first. layout graphSkip TU**

    Don't translate directly. reading_order chain together. Treat block For graph nodes, edges include:

    - Same-page adjacent
    - Same-column adjacent
    - Hurdle Candidate
    - Cross-page candidates
    - Title to Body
- Chart caption Go to Chart
    - footnote To body citation
2. **Separate translation and rendering units**

One TU can span multiple blocks but retain the original when backfilling. block anchor." – but "blockbut" should be "blocks but". Also "block anchor" is part of it. So: "    One TU can span multiple blocks but retain the original when backfilling. block anchor.

This way, continuation wrong judgment won't immediately destroy page structure.

3. **All outputs include status.**

Each TU should finally have:


```json
{
  "status": "ok | repaired | warning | failed | fallback_source",
  "severity": "P0 | P1 | P2 | P3",
  "validator_errors": [...],
  "repair_attempts": 1,
  "exportable": true
}
```

Large document systems dread one phrase: all or nothing.

500 Page tasks must allow**Partial failure, partial degradation, full export**。

# 2. block、paragraph、page、TU How to select

Recommended conclusion:

| Granularity | Recommended? | Reason |
| --- | --- | --- |
| --- | ---: | --- |
| page | not recommended as the minimum translation unit | prompt Too large, complex page structure, high failure cost.retry Costly |
| block | No translation. | OCR block Frequently fragments sentences, terminology and context inconsistent. |
| paragraph | Serves as intermediate layer. | Works well for the main text, but for tables,caption, footnotes, and text near formulas are unstable |
| TU | Recommended | Dynamically splittable by semantics and layout. Suitable for concurrency, validation, ...repairFill |

TU Size suggestion:

```
Body text: 80 to 300 tokens
Complex scientific paragraphs: 100 to 500 tokens
Table cell: one cell or a group of cells of the same kind
caption: complete caption
Title: Separate TU
Formula description: text outside formulas separate. TUFormula itself protected.
Footnote: separate TUPlease provide the source text to translate.
```

Don't pursue. TU Bigger is better.

Large TU increases context, but adds empty translations, explanation leakage, timeouts, format corruption. Your current symptoms already show it. batch or TU too large, too many constraints. Retry strategy lacks layering.

# 3. continuation detection Where to place it

My suggestion: three-part structure.

```
LLM Before: Rules + layout graph generate continuation candidates
LLM Only allow low-risk semantic relation judgments. Do not allow direct structural changes.
Local fixes only, no major restructuring.
```

## 3.1 LLM Must do before

continuation Signal candidates use rules first.

1. Geometric Signal
    - bbox Vertical distance
    - Same column x overlap
    - Column width
    - Margins
    - Span pages?
- Whether in header/footer region
2. Text signal
- Previous block whether it ends with a period, question mark, colon, or semicolon
    - Next block whether it starts with a lowercase letter
    - Hyphenate words
    - Is it like list numbering?
    - Match title?
    - Include equation numbers?
3. Semantic role signals
- body followed by body candidate
- title followed by body: do not merge
- caption followed by body: usually not merged
- footnote followed by body: establish reference only. No merge.
4. reading_order signal
- Same-page order continuous
- Cross-column order jump?
    - whether cross-page continuity from last body text on previous page to first body text on next page

Please provide the source text to translate. yes/nobut rather:

```json
{
  "edge_type": "same_paragraph_candidate",
  "confidence": 0.82,
  "risk": "low | medium | high",
  "reasons": ["no_terminal_punctuation", "same_column", "small_vertical_gap"]
}
```

## 3.2 LLM Handle low-confidence candidates only

Do not let LLM cross-page merge at your discretion.

It can answer:

```json
{
  "is_continuation": true,
  "confidence": 0.67,
  "reason_code": "sentence_continues"
}
```

but cannot directly combine the two block Merge into new structure. Structural writes must be executed by your rules layer.

## 3.3 Catastrophic misjudgment reduction methods.

Most critical:**Non-destructive merge**。

That is, even if judging two blocks are continuation, do not delete the original block. Use virtual paragraph group:

```json
{
  "paragraph_group_id": "pg_123",
  "members": ["b10", "b11"],
  "merge_mode": "virtual",
  "render_split": "preserve_original_blocks"
}
```

Provide source text to translate. TU or adjacent TUbut backfill still press block anchor cut back.

If switching back is difficult, let one. TU For multiple block Generate translated_segments：

```json
{
  "tu_id": "tu_123",
  "segments": [
    {"block_id": "b10", "translated_text": "..."},
    {"block_id": "b11", "translated_text": "..."}
  ]
}
```

High risk continuation Strategy:

```
High confidence: allow virtual merge translation
Medium confidence: translate separately, but provide. read-only neighbor context
Low confidence: separate completely, enter only. diagnostics
```

This misjudgment won't escalate context leakage to a page-level incident.

# 4. quality gate Leveling

You shouldn't only have pass/fail。

## 4.1 P0 Block request. TU export

These issues cannot be overlooked:

| Type | Example | Handling |
| --- | --- | --- |
| Empty translation | source non-empty but target empty | retry or repair; on failure fallback_source and highlight in red |
| schema error | JSON parse failed, field missing, id mismatch. | retry |
| item quantity error | input 10 TUs, output 9 or 11 | retry |
| placeholder Missing | `⟦PH_001⟧` Data inconsistency. Clean duplicates. Validate inputs. | repairFailure tolerated. |
| Formula Corruption | LaTeX token Lost formula numbering. | repair or Rollback |
| Explain leakage | Meta-phrase omitted. Provide source text for translation.Here is the translation” | repair |
| Obviously not translated | Whole paragraph of English remains, and the target is Chinese | retry/repair |
| Severe truncation. | target abnormally short length, semantically obviously incomplete | retry |
| Error page/wrong id | target written to another tu_id | Block |
| Protect span order error | References, footnotes, equations out of order. | repair |

P0 is a local block, not the entire PDF blocked.

Unless P0 Exceeds threshold, e.g.:

```
P0 TU ratio > 0.5%
or P0 page ratio > 2%
or continuous 3 Page exists. P0
```

Only then block entire document export.

## 4.2 P1Must try repairBut degrade export

| Type | Example | Handling |
| --- | --- | --- |
| Hard terminology constraint miss. | User glossary specifies A must be translated as B | repair |
| Medium English residue detected. | English phrase remnants remain, but not formulas./abbreviations | repair |
| Minor format errors | Inconsistent list markers, line breaks, and punctuation. | repair |
| Abnormal length ratio | target/source ratio abnormal | repair |
| duplicate output | Repeat same sentence twice. | repair |
| style clearly deviated | Convert to summary, explanation, rewrite. | repair |

P1 repair After failure, export possible but login required. manifest。

## 4.3 P2Only allow inbound diagnostics

| Type | Example |
| --- | --- |
| Soft terminology preference miss. | domain glossary Recommendations not working. |
| Minor English residue. | DNA、HOMO、Gaussian This kind may not be translated originally |
| continuation Low confidence | Structure uncertain but no format error |
| translation is slightly long | May affect formatting, not content. |
| Slight style inconsistency. | Calculation results indicate vs Calculation result displayed |

## 4.4 P3, statistical indicators

For example:

```
Average length expansion ratio
Term hit rate
repair Success Rate
tail retry Count
warning count per page
```

P3 Health checks metrics only. Regression tests only.

# 5. repair pipeline How to design

repair Must not be a re-translation.

repair should be a local fix for validator errors.

Recommended state machine:

```
translate
→ validate
→ if P0/P1: targeted retry
→ validate
→ if still failed: targeted repair
→ validate again
→ if still failed: fallback policy
→ manifest
```

LLM repair Must be repeated after. validator。

Do not blur this boundary. Just LLM Participate in generation; result must pass. validator。Structured output 和 validator It is the core defense line of the production system, not prompt Accessory. Structured output reduces parsing and format drift risk, but still requires. schema validation and business rule validation.[Cohere, Validating Outputs, https://cohere.com/llmu/validating-llm-outputs, Access date 2026-05-27][[1]](https://cohere.com/llmu/validating-llm-outputs)

## 5.1 repair Input should be minimal

Do not feed the entire page to repair。

```json
{
  "source_text": "...",
  "bad_translation": "...",
  "validator_errors": [
    {
      "code": "PLACEHOLDER_MISSING",
      "missing": ["⟦MATH_003⟧"]
    }
  ],
  "constraints": {
    "must_keep_placeholders": ["⟦MATH_003⟧"]
  }
}
```

Make it output only:

```json
{
  "tu_id": "...",
  "repaired_translation": "..."
}
```

## 5.2 repair classification

| Error | Recommended repair method |
| --- | --- |
| placeholder missing | Fix rules first if location determinable; otherwise defer. LLM |
| formula corruption | Priority rule backfill: disallow LLM rewriting formulas |" Actually "disallow. LLM rewrite formulas" might mean "disallow LLM rewriting formulas". So: "| formula corruption | Priority rule backfill: disallow LLM rewriting formulas |
| empty translation | re-translate, not called repair |
| residual English | LLM repair |
| explanation leakage | Rule stripping + validator, when necessary LLM repair |
| Term not found. | LLM repair, but give hard glossary |
| duplicate output | Rule deduplication first; semantic uncertainty second. LLM |
| continuation Merge error | Not recommended. repair Hard fix, revert to. TU segmentation Rerun partial area |

## 5.3 repair What to do on failure

Bad translation removed. Recommended strategy: keep source verbatim.

```
P0 repair failure:
fallback_source, mark failed_exportable=false or true depending on business.
  manifest Log to file
  UI Human review required.

P1 repair failure:
keep best candidate
  status=warning
log diagnostics

P2：
do not repair; log only.
```

Allow? fallback to the original text?

Yes, but must be explicitly marked:

```json
{
  "status": "fallback_source",
  "reason": "EMPTY_TRANSLATION_REPAIR_FAILED",
"display_text": "Original...",
  "needs_review": true
}
```

Do not disguise fallback_source as successful translation. Major pitfall.

# 6. tail latency Specify context.

Your last few batch Slowness typically stems from four causes:

1. batch contains oversized items item
2. Some requests trigger model slow path.
3. 429 Retreat causes queuing.
4. Main queue nearing end. Only straggler

Use three queues:

```
main_queue: first translation
retry_queue：429 / 5xx / timeout Retry later.
tail_queueSlow itemProblem unsolved. item、repair item
```

Don't block main queue indefinitely. retryMain queue runs first attempts only. Retry queue handles rest. retry。

## 6.1 timeout strategy

Dynamic length timeout by token:

```
timeout = base + α * input_tokens + β * expected_output_tokens
```

Don't remove all. Timeout per item: long paragraphs harsh, short headings lenient.

## 6.2 429

429 Must respect `Retry-After`Not found. header When, use exponential backoff + jitter。429 Common handling: rate limiting, queuing, wait per server hint, exponential backoff.[Postman, HTTP Error 429 Too Many Requests, https://blog.postman.com/http-error-429/, Accessed date 2026-05-27][[2]](https://blog.postman.com/http-error-429/)

Strategy:

```
429：
put into throttle_retry_queue
rate limiting per provider/model dimension
  No main_queue worker
```

## 6.3 5xx

```
5xx：
retry 1 to 2 times
  exponential backoff + jitter
  Proceed after exceeding limit. tail_queue
```

## 6.4 Single slow item

Recommendation:

```
Exceeds current model. p95 latency：
mark as slow_candidate

Exceeds p99 or hard deadline:
  cancel or hedge
put into tail_queue
```

hedged request Can reduce tail latency, but be cautious. Request pair. LLM is costly, cannot be copied indiscriminately. Only for:

```
High-value tasks
Deadline near.
Queue low
429 Low rate
Available token budget enough.
```

only hedge。

## 6.5 tail retry When does it start

Two trigger conditions:

```
main_queue remaining < 10% to 20%
or
certain item age > p95_latency * 1.5
```

Resource allocation recommendations:

```
main_queue：80% worker
retry_queue：15% worker
tail_queue：5% worker
```

When main_queue is below 20%:

```
main_queue：50%
retry_queue：25%
tail_queue：25%
```

This way, tail normal tasks are not preempted.

## 6.6 batch strategy

Don't use fixed. batch sizeUse. token bucket batching：

```
Each batch limit:
  max_items
  max_input_tokens
  max_expected_output_tokens
  max_layout_complexity
```

And bucket by complexity:

```
short_title
normal_paragraph
long_paragraph
table_cell
caption
formula_heavy
repair
```

Do not mix formula-heavy items with ordinary text. Bad batch input will slow down the entire batch.

# 7. glossary / memory / context How to design

Terminology consistency should not rely on putting all glossary Insert prompt。

Should implement layering + retrieval + distinguish hard/soft constraints.

Translation memory 和 glossary Two distinct items:TM Reuse translated segments,glossary Glossaries and specified translations both improve consistency, but serve different purposes.[Language Scientific, WhatShould implement **layering + retrieval + hard/soft constraint differentiation**.s The Difference Between Translation Memory and Glossary, https://www.languagescientific.com/whats-the-difference-between-translation-memory-tm-and-a-glossary/, 访问日期 2026-05-27][[3]](https://www.languagescientific.com/whats-the-difference-between-translation-memory-tm-and-a-glossary/)

CAT/TMS Tools also typically glossary、translation memory、tag 或 placeholder QA Handle separately.[Smartcat, Translation memories glossaries, https://help.smartcat.com/6987550190610-leveraging-smartcat-linguistic-assets/, access date 2026-05-27][[4]](https://help.smartcat.com/6987550190610-leveraging-smartcat-linguistic-assets/)

## 7.1 Recommended priority

```
L0 User‑forced glossary
L1 project glossary
L2 Document glossary
L3 Auto Extract memory
L4 Domain Glossary
L5 Model default knowledge
```

On conflict:

```
User-forced glossary > project glossary > documentation terminology > memory > domain glossary
```

Each term should have attributes:

```json
{
  "source": "oscillator strength",
  "target": "oscillator strength",
  "priority": "hard | preferred | hint",
  "domain": "computational_chemistry",
  "case_sensitive": false,
  "allowed_variants": ["Oscillator strength"],
  "do_not_translate": false
}
```

## 7.2 Each item Inject on hit, not globally.

Recommend prompt Put in:

```
Global: translation style, target language, minimal high-priority terminology
Local: hard/preferred terms matched in current TU
Search:top-K Similar TM examples
Context: Summary of previous segment; avoid excessive original text.
```

Local glossary retrieval：

```
source_text exact match
+ lemma/stem match
+ phrase match
+ domain match
+ section match
```

Suggested number of terms to inject per TU:

```
hard termsUnlimited, but typically not many.
preferred terms: top 10 to 30
hint terms: top 5 to 10
TM examples: top 1 to 3
```

Do not exceed this amount.prompt Larger = slower, less stable. Already encountered.

## 7.3 Terminology validator

Terminology consistency should not rely solely on promptTo do. validator：

```
If a hard term appears in source:
  target the specified translation must appear
otherwise P1 repair

If a preferred term appears in source:
  target On miss, P2 diagnostics
```

Terms QA、placeholder QA Common translation quality check item.[Phrase, Quality Assurance Strings, https://support.phrase.com/hc/en-us/articles/5820046486684-Quality-Assurance-Strings, 访问日期 2026-05-27][[5]](https://support.phrase.com/hc/en-us/articles/5820046486684-Quality-Assurance-Strings)

# 8. translation memory Concurrent update

Do not let all worker Real-time read and write to same. memory。

This will cause instability:

```
worker A translates first term X as ç²
worker B simultaneously translates term X as ä¹
worker C Read to A
worker D Read to B
Final Book Drift
```

Recommend snapshot + epoch merge.

## 8.1 Before document-level tasks begin

```
read user glossary
read project glossary
read domain glossary
read history TM
build memory_snapshot_v1
```

All workers read-only snapshot in the same round.

## 8.2 Per chapter or per N Page merge once.

For example:

```
every 20 Page One epoch
Or one per chapter epoch
```

epoch After completion:

```
Collection passed. validator High-confidence translation.
Extract Term Candidates
Detect Conflicts
update document_memory_v2
Next epoch Use new snapshot
```

Long documents improve consistency while retaining earlier context's benefit to later sections.

## 8.3 Define scope. TM

Only allow these in:

```
status=ok
or status=repaired and second_validator_pass=true
No translation needed. P0/P1
and source/target length ratio normal
and no obvious English remnants
```

Do not write fallback_source, warning, or unconfirmed repair into TM. No translation.

# 9. Which is most critical for preventing model explanation leakage?

Sort order:

```
structured output / constrained decoding
> validator
> retry / repair
> prompt constraints
```

prompt is just a soft constraint.

Production systems cannot rely on a single "output translation only" instruction to solve problems.

No source text provided. Send Chinese text to translate. schema：

```json
{
  "items": [
    {
      "tu_id": "string",
      "translation": "string",
      "status": "translated"
    }
  ]
}
```

Strict requirement:

```
additionalProperties=false
items Quantity must equal input.
tu_id Must exactly match.
translation Not empty
translation Must not contain explanatory templates
```

Explain that leak detection can use rules:

```
"Here is the translation"
"Sure,"
"The meaning of this passage is"
"Translates as."
"The translation is as follows"
"I will."
"As a"
```

But don't rely on keywords alone. Add two more checks:

```
target Include? source Copy Large Section
target Include? instruction/prompt Fragment
```

If structured output is still leaking, direct P0/P1:

```
First time:retry with stricter error message
Second:repair strip/extract
Third:failed or fallback_source
```

# 10. Formula,placeholder、inline math How to protect

Scientific Paper/Textbooks PDFFormula protection must rely on rule placeholders.

Do not trust the model to preserve formulas in their original format.

Reason: formulas are precise objects, not natural language. Math translation demands extreme symbol precision, unlike standard text.[Petersen et al., Neural Machine Translation for Mathematical Formulae, ACL 2023, https://aclanthology.org/2023.acl-long.645.pdf][[6]](https://aclanthology.org/2023.acl-long.645.pdf)

## 10.1 Protected object

Suggested protection:

```
display math
inline math
LaTeX command
Equation numbering
citation numbers [1], (3.2), Eq. (5)
variable name
units
Chemical formula
DOI / URL / email
Placeholder
figure/table references
footnote markers
```

For example:

```
The oscillator strength $f$ is defined by Eq. (3).
```

First change to:

```
The oscillator strength ⟦MATH_001⟧ is defined by ⟦REF_001⟧.
```

After translation:

```
Oscillator strength ⟦MATH_001⟧ defined by ⟦REF_001⟧.
```

Then restore:

```
振子强度 $f$ 由 Eq. (3) 定义。
```

If you wish “Eq. (3)” also localized as "Eq. (3)Don't protect the entire thing. `Eq. (3)`, instead split into:

```
Eq. ⟦REFNUM_001⟧
```

let the model translate Eq.Protection number.

## 10.2 placeholder token Design unnecessary. Ship simplest solution.

token Must satisfy:

```
Model not easily rewritable.
Regex easily recognized.
No conflict with body.
can preserve order
Can do. multiset check
```

Recommendation:

```
⟦MATH_000001⟧
⟦PH_000002⟧
⟦REF_000003⟧
⟦CHEM_000004⟧
```

validator check:

```
aid, when prices appear to be entering a downtrend, this tool shows that buyers are more likely increasing buying pressure ( placeholder multiset == output placeholder multiset
Can the order be changed?
Any unknown? placeholder
Duplicate?
Missing?
```

Official does not recommend allowing LLM Fix.

If it can be fixed by rules, fix it by rules; if not, retranslate that TU。

# 11. Pre-translation: glossary, style guide, context. Post-translation: QA, LQA, feedback.diagnostics

## 11.1 Resolve before main translation.

| Problem | Reason |
| --- | --- |
| OCR block clean | Dirty input amplifies LLM errors |
| header/footer/page number Identify | Otherwise pollutes context. |
| formula / placeholder Protect | this is a hard constraint |
| TU segmentation | Determine concurrency granularity and failure boundaries. |
| continuation candidate detection | Structural issues first. |
| glossary Conflict resolution | otherwise translation drifts |
| memory snapshot | Concurrency consistency depends on it. |
| batch Bucketing | avoid long item slow down short item |
| export policy | First define what is meant by 'exportable'. |

## 11.2 Translated repair

| Problem | repair method |
| --- | --- |
| empty translation | re-translate, not repair |
| English residue | LLM repair |
| explanation leakage | rule stripping + LLM repair |
| term miss | LLM repair |
| placeholder Slight misalignment | Rules prioritize. |
| duplicate output | rule deduplication or LLM repair |
| Length error | re-translate or LLM repair |
| style deviation | LLM repair |

## 11.3 Only do diagnostics

| Problem | Reason |
| --- | --- |
| soft glossary Miss | Long document not block. |
| Minor English abbreviation remnants. | Common in scientific texts |
| Low confidence continuation | For manual review. |
| Slight length expansion | Submit to rendering or manual review. |
| minor style fluctuations | Large documents are difficult to eliminate completely. |
| Possible term conflict | in the next round glossary Update resolved. |

## 11.4 Areas where hard-coding rules is inappropriate

| Scenario | Why |
| --- | --- |
| Complex semantic re-translation | rules do not understand semantics |
| continuation Large-scale rearrangement | May break layout. |
| Grammar adjustments due to terminology | requires LLM |
| English remnants in long sentences. | rule replacement can easily create ungrammatical sentences |
| Table Semantics Normalization | Need context. |
| Post-merge paragraph cohesion | requires LLM |

Rules suit protection, detection, rollback, partial recovery.

LLM Suitable for semantic translation, terminology integration, and ungrammatical sentence repair.

# 12. 500+ Page recommendations metrics

Monitor three metrics: throughput, quality, structural risk.

## 12.1 Performance metrics

```
per_item_latency_p50 / p90 / p95 / p99
per_batch_latency_p50 / p95 / p99
queue_wait_time
tokens_per_second
items_per_minute
pages_per_hour
main_queue_remaining
retry_queue_size
tail_queue_size
tail_queue_oldest_age
timeout_count
429_count
5xx_count
hedged_request_count
cancelled_request_count
```

Focus on p95/p99, don't just look at the average. Tail latency is inherently a distribution problem; a small number of straggler Can drag down overall completion time.[Tail Latency Study, https://accelazh.github.io/storage/Tail-Latency-Study, 访问日期 2026-05-27][[7]](https://accelazh.github.io/storage/Tail-Latency-Study)

## 12.2 Translation quality metrics

```
empty_translation_count
schema_error_count
explanation_leak_count
source_copy_ratio
english_residual_ratio
length_ratio_outlier_count
duplicate_output_count
truncation_count
retry_success_rate
repair_success_rate
second_validator_fail_rate
fallback_source_count
```

## 12.3 Structural protection metrics

```
placeholder_mismatch_count
formula_mismatch_count
unknown_placeholder_count
placeholder_order_error_count
inline_math_restore_fail_count
citation_marker_error_count
table_cell_count_mismatch
list_marker_damage_count
```

## 12.4 Terminology consistency metric

```
hard_glossary_hit_rate
preferred_glossary_hit_rate
glossary_conflict_count
term_translation_variants_per_doc
term_drift_by_chapter
TM_reuse_rate
TM_conflict_rate
memory_update_rejected_count
```

## 12.5 continuation Risk indicator

```
continuation_candidate_count
high_confidence_merge_count
medium_confidence_context_only_count
cross_page_merge_count
cross_column_merge_count
continuation_repair_count
context_bleed_suspected_count
paragraph_split_error_count
```

## 12.6 Document-level export metrics

```
P0_count
P1_count
P2_count
P0_page_count
P1_page_count
failed_TU_ratio
fallback_TU_ratio
review_required_page_count
export_blocked_reason
```

Suggest defining health threshold:

```
green:
  P0 ratio < 0.1%
  fallback ratio < 0.2%
  hard glossary hit rate > 99%
  placeholder mismatch = 0 after repair

yellow:
  P0 ratio < 0.5%
  fallback ratio < 1%
  P1 ratio < 3%

red:
  P0 ratio >= 0.5%
  fallback ratio >= 1%
  placeholder mismatch unresolved > 0
  formula restore fail > 0
```

# 13. Recommended final strategy

If I were to propose an engineering plan for you, I would do it like this:

## 13.1 Before main translation

```
1. build layout graph
2. Clear header/footer/page number
3. Protect formulas,placeholderCitation, Chemical Formula, Unit
4. segment TU, do not press directly by block or page
5. continuation Generate candidates and confidence scores only
6. glossary Resolve conflicts first, then layer.
7. TM uses snapshot
8. batch by token and complexity bucketing
```

## 13.2 Translating

```
1. structured output
2. each output must include tu_id
3. Forbid free‑text output
4. small batch, multiple worker
5. Main queue no reorder retry
6. 429 / 5xx / timeout Process in queues.
```

## 13.3 After translation

```
1. deterministic validator Run first
2. repair only for P0/P1
3. repair Must be done again afterwards. validator
4. repair fails → skip: custom validation, add when spec changes. fallback_source or failed
5. Don't allow small bad data. TU Block entire book
```

## 13.4 glossary / memory

```
1. user glossary highest priority
2. each TU inject only matched terms.
3. Place only a few global rules at the document level.
4. TM Concurrent read-only snapshot
5. per chapter or per 20 Merge pages once. memory
6. only validator-approved translations go into memory.
```

## 13.5 export

```
1. P0 unresolved: mark this TU as failed or fallback_source
2. Export decision based on threshold, not individual failures.
3. manifest Log all downgrades.
4. diagnostics Transfer to human. review
```

In a nutshell:

> The core of the large PDF translation system is not to make every item correct the first time, but to enable each item to be isolated, validated, repaired, degraded, and traced.
>

> page Rendering unit.block It is a layout unit,TU The translation unit.
>

> continuationFormulaplaceholder、glossary Control conflicts pre-translation; handle EN remnants, explanation leaks, term misses post-translation. repair；soft glossary Proceed with low-confidence structural risk diagnostics。
>