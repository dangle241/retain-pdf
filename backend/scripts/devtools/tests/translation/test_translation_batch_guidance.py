from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.translation.llm.shared.control_context import EngineProfile
from services.translation.llm.shared.control_context import FallbackPolicy
from services.translation.llm.shared.control_context import build_translation_control_context
from services.translation.llm.shared.orchestration.batched_plain import translate_items_plain_text
from services.translation.services.terms import GlossaryEntry
from services.translation.workflow.batching.pending_units import _translate_batch_or_keep_origin


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_translate_batch_wrapper_appends_relevant_job_memory_to_domain_guidance() -> None:
    captured: dict[str, object] = {}

    class _MemoryStore:
        def summary(self) -> str:
return "Doc memory: keep terminology consistent.\n- SCF => self-consistent field\n- DFTB => density functional tight binding"

        def summary_for_batch(self, batch) -> str:
            source = "\n".join(str(item.get("source_text") or "") for item in batch)
            if "SCF" in source:
return "Block-related doc memory: keep terminology consistent.\n- SCF => self-consistent field"
            return ""

    def _fake_translate_fn(*_args, **kwargs):
        captured["domain_guidance"] = kwargs["domain_guidance"]
        captured["context"] = kwargs["context"]
        return {"a": {"decision": "translate", "translated_text": "自洽场"}}

    result = _translate_batch_or_keep_origin(
        [_item("a", "SCF")],
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="book: batch 1/1",
        domain_guidance="Document domain: quantum chemistry.",
        mode="fast",
        context=build_translation_control_context(),
        memory_store=_MemoryStore(),
        translate_fn=_fake_translate_fn,
    )

assert result["a"]["translated_text"] == "self-consistent field"
assert "Document domain: quantum chemistry." in captured["domain_guidance"]
assert "SCF => self-consistent field" in captured["domain_guidance"]
    assert "DFTB =>" not in captured["domain_guidance"]
assert "SCF => self-consistent field" in captured["context"].merged_guidance
    assert "DFTB =>" not in captured["context"].merged_guidance


def test_translate_items_plain_text_sends_only_matched_glossary_entries_to_prompt() -> None:
    captured: dict[str, str] = {}
    batch = [
        _item(
            "a",
            "The SCF cycle is converged before evaluating the total energy.",
            _batched_plain_candidate=True,
        ),
        _item(
            "b",
            "Hartree-Fock orbitals provide the initial guess.",
            _batched_plain_candidate=True,
        ),
    ]
    context = build_translation_control_context(
        glossary_entries=[
GlossaryEntry(source="SCF", target="self-consistent field", level="preferred"),
GlossaryEntry(source="DFTB", target="density functional tight binding", level="preferred"),
            GlossaryEntry(source="Hartree-Fock", target="Hartree-Fock", level="preserve", match_mode="case_insensitive"),
        ]
    )

    def _translate_batch_once(batch_arg, **kwargs):
        captured["domain_guidance"] = kwargs["domain_guidance"]
        return {
            item["item_id"]: {
                "decision": "translate",
"translated_text": "translated",
                "final_status": "translated",
            }
            for item in batch_arg
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test glossary scope",
        context=context,
        diagnostics=None,
        single_item_translator=lambda *_args, **_kwargs: {},
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=_translate_batch_once,
    )

assert result["a"]["translated_text"] == "Translated"
    assert '"source": "SCF"' in captured["domain_guidance"]
assert '"target": "self-consistent field"' in captured["domain_guidance"]
    assert "DFTB" not in captured["domain_guidance"]
    assert '"source": "Hartree-Fock"' not in captured["domain_guidance"]
    assert result["a"]["translation_diagnostics"]["term_scope"]["glossary_sources"] == ["SCF"]
    assert result["b"]["translation_diagnostics"]["term_scope"]["glossary_sources"] == ["Hartree-Fock"]


def test_batched_plain_main_request_uses_fast_fail_http_attempt_budget() -> None:
    captured: dict[str, int] = {}
    batch = [
        _item(
            "a",
            "This body paragraph is long enough for the batched plain translation path.",
            _batched_plain_candidate=True,
        ),
        _item(
            "b",
            "A second body paragraph keeps this test on the direct batched request path.",
            _batched_plain_candidate=True,
        ),
    ]
    context = build_translation_control_context(
        engine_profile=EngineProfile(
            fallback_policy=FallbackPolicy(main_http_retry_attempts=1, tail_http_retry_attempts=3),
        )
    )

    def _translate_batch_once(batch_arg, **kwargs):
        captured["http_retry_attempts"] = kwargs["http_retry_attempts"]
        return {
            item["item_id"]: {
                "decision": "translate",
"translated_text": "Translated",
                "final_status": "translated",
            }
            for item in batch_arg
        }

    result = translate_items_plain_text(
        batch,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="test fast fail",
        context=context,
        diagnostics=None,
        single_item_translator=lambda *_args, **_kwargs: {},
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=_translate_batch_once,
    )

assert result["a"]["translated_text"] == "Translated"
assert result["b"]["translated_text"] == "Translated"
    assert captured["http_retry_attempts"] == 1
