# Skills Design (Draft)

**Status:** Draft v0.1(In conjunction with [AI_RUNTIME.md](./AI_RUNTIME.md))
**Date:** 2026-07-21

---

## 1. Skill vs Tool

| | Tool | Skill |
|--|------|--------|
| Granularity. | Atomic I/O | Task-oriented capability package |
| Content | name + JSON Schema + handler | Tool subset + Prompt + Strategy |
| Test | handler Unit test | scenario/Contract Testing |
| Example | `search_fulltext` | `literature-qa` |

One sentence:

> **Tool Verb;Skill It's a script.**

---

## 2. Package format

```text
retainpdf_ai/skills/literature_qa/
  skill.yaml      # Checklist
  prompt.md       # system(detachable) system.md / developer.md）
# Optional policy.py  â Add when strategy complex.
```

### skill.yaml

```yaml
id: literature-qa
version: 1
display_name: Full Document Q&A
description: >
  In a single document (or specified jobSearch and answer within scope; enforce anchor references.
tools:
  - search_fulltext
  - read_blocks
  - search_favorites
# list_documents Intentionally excluded from reader. skill
policies:
  require_document_scope: true
  allow_global_search: false
  max_tool_rounds: 6
  output_locale: zh-CN
  require_citations: true
  allow_markdown_images: true
model:
  # Optional override; empty uses request./Global config
  temperature: 0.3
```

### prompt.md

- Existing `SYSTEM_PROMPT` Entity Move-In  
- Placeholder (replaced during assembly):

```text
{{document_id}}
{{job_id}}
{{evidence_table}}   # Memory Injected known evidence table, nullable
```

---

## 3. Loader interface

```python
class Skill(Protocol):
    id: str
    version: int
    tools: list[str]
    policies: dict
    def system_prompt(self, *, scope, evidence_table: str) -> str: ...

def load_skill(skill_id: str) -> Skill: ...
def list_skills() -> list[SkillMeta]: ...
```

Error:`unknown skill` → 400。

---

## 4. First release:literature-qa

Behavior alignment with today's reader Q&A:

- scope force document  
- Tool layer injection document_id / job_id  
- Reference [n] + image_urls Embeddable
- Do not expose. list_documents  

Acceptance: same quality as live network answers; config only./Prompts externalized; no functional fallback.

---

## 5. Subsequent Skill Candidate

| id | Scenario | Possible Tools |
|----|------|----------|
| `annotation-assist` | Based on comments/Selection Explanation | read_blocks, search_favorites |
| `paper-compare` | Compare Documents | search_fulltext×2, read_blocks |
| `figure-explain` | Image processing. Use stdlib. Pillow for PIL. No OpenCV unless GPU needed. Prefer `subprocess.run` over `os.system`. Keep formats exact. No invented abbreviations./Table | read_blocks, list_page_images(addable tool) |

---

## 6. With Multi-agent

Skill Declarable:

```yaml
agents:
  - role: retriever
    tools: [search_fulltext, read_blocks]
  - role: analyst
    tools: []    # Write only
```

v0 Ignore `agents` Fields, single loop executes all. tools。  
Write fields first. schemaAvoid future package format changes.

---

## 7. Execution order

1. Directory + loader + literature-qa Migrate In (Behavior Unchanged)
2. ask Request Support `skill_id`  
3. second skill Re-prove extensibility.  
