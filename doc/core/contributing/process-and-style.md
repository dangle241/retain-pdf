# Issue、PRCode style and release notes

## Issue Flow

## Issue flow

- RetainPDF Version, runtime: Desktop / Docker / Local development.
- Operating system and browser.
- OCR provider, model provider, task workflow.
- job_idFailure stage, error summary, or screenshot.
- Steps to reproduce.
- Expected and actual results.
- If applicable PDF Sample; indicate whether disclosable. If not, provide minimal screenshots, page numbers.bbox or anonymized samples.

When submitting a feature request, try to include:

- Use cases.
- How you want the frontend/API/How to expose command line?
- Compatibility with existing jobs, artifacts, reader, library, or Docker delivery.
- Potentially affected modules.

Security issues, key leaks, private data — do not expose publicly. IssueThrough what? README discussion group or GitHub Contact maintainer via private channel; if only public submission, describe only impact scope, do not include keys, actual files, or identifiable user data.

## PR process

Recommended process:

1. Open first Issue or existing Issue explain the plan, especially across Rust/Python/frontend/Docker of the changes.
2. From latest `main` Create a branch.
3. Keep PR focused, solve one topic at a time.
4. Code changes include tests, or explain why tests cannot be added yet.
5. Update relevant documentation.
6. PR Describe clearly what changed, why, and how to verify.

PR Description should include:

```md
## Change

- ...

## Verification

- [ ] cargo test --manifest-path backend/rust_api/Cargo.toml
- [ ] python3 backend/scripts/devtools/check_pipeline_architecture.py
- [ ] npm --prefix desktop run verify-frontend-sync

## Risks

- ...
```

If PR modifies user-visible behavior, please attach screenshots, API examples, sample job_id, or before/after comparison.

## Retain existing style.

Use existing module style naming.

- First, search the same directory for 2-3 similar implementations; follow their naming, error handling, return types, test patterns, and file organization.
- Existing module named `*_view`、`*_payload`、`*_manifest`、`*_contract` when, new field or helper Reuse existing terminology. Avoid introducing new terms. `dto/result/response/entity` Mix.
- When existing code uses narrow dependency parameters, do not fall back to passing the entire object. `AppState`Global config or larger dict。
- Existing API has view/projection layers; do not temporarily assemble JSON in routes.
- Existing Python pipeline uses stage spec, manifest, document.v1; do not bypass to read provider raw JSON directly.

## Never. Abstraction is premature optimization. Add only when you have three concrete implementations and a clear, repeating pattern that hurts maintainability. YAGNI.

Don't add framework-style abstractions for single small requirements. Skip if: - One-off helper - Single-use case - No future expansion - No shared logic across modules

- Just add a field, a button, a download entry, or a validation branch.
- Không trừu tượng. Lặp ít, chưa đáng. Giữ nguyên. Nếu xuất hiện call thứ ba → gộp hàm nhỏ.
- Just making names "more generic" without reducing real complexity.
- Wraps originally clear sequential logic into multiple layers. class/factory/manager。

Cases where abstraction can be added:

- Same logic already in 3 Duplicate code. Hard to maintain. Refactor: extract shared logic into function.
- Existing functions already mixed. IOStrategy, data transformation, error handling complicate testing. Remove one.
- New abstraction can narrow cross-layer dependencies, e.g., turning route Business logic move to backend. service。
- New abstractions can form stable contracts, e.g. artifact manifest、reader region、translation diagnostics。

When adding abstraction,PR In the description, state:

- What duplication or coupling does it replace?
- Which layer does it belong to?
- Which modules may depend on it, and which should not.

## Scope of changes

- Unrelated refactoring not mixed into feature changes. PRFeature fix separate. Rename separate. Directory move separate. Formatting separate.
- Do not modify large numbers of unrelated files, sort imports, rearrange CSS, or rewrite legacy logic unless it is the goal of this PR. importReorder CSS Or rewrite history logic, unless this is the base. PR the goal.
- Do not commit local keys, tokens, real user files, data/db/jobs.db, data/jobs/* large build artifacts, tmp/*, or large experimental outputs.

## Performance and large-sample changes

Rendering,PDF Process, translate batch processingOCR adapter Such changes may 500 Pages+ PDF Significant impact. For performance-sensitive cases, provide:

- Sample page count and file type.
- Old duration, new duration.
- Command used or job_id。
- whether it changes the output PDF Content, size, or first-screen preview experience.

Large samples, temporary CSVs, benchmark outputs should be placed in experiments/ or tmp/; by default, do not commit to repo.

## Deployment and Operations

Ordinary contributors usually don't need to. tag Or release package. Maintainer separately executes version commit when releasing.tag、GitHub pushDesktop sync Docker/Release Process.

If your PR will affect the release package, describe in the PR:

- Affects desktop? bundle。
- Does it affect? Docker runtime config。
- Need database migration or legacy compatibility? job。
- Update needed? README、API Documentation or user installation instructions.

Maintainer releases, Docker delivery, and online operations see Operations and process records and Docker documentation.
