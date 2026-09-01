from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.translation.services.memory import JobMemory
from services.translation.services.memory import JobMemorySnapshot
from services.translation.services.memory import JobMemoryStore
from services.translation.services.memory import update_job_memory_from_batch
from services.translation.services.memory.candidates import extract_scored_term_candidates


def test_job_memory_extracts_translated_term_pairs_and_prompt_summary(tmp_path) -> None:
    memory = JobMemory.empty(tmp_path / "job-memory.json")
    batch = [
        {
            "item_id": "p001-b001",
            "source_text": "Color centers are also called F-centers.",
            "protected_source_text": "Color centers are also called F-centers.",
        }
    ]
    translated = {
        "p001-b001": {
            "translated_text": "Color centers (F-centers) are also known asFHeart.",
        }
    }

    changed = update_job_memory_from_batch(memory, batch=batch, translated=translated)

    assert changed >= 1
    assert memory.terms["F-centers"]["value"] == "Lust"
    assert "F-centers => Lust" in memory.prompt_summary()


def test_job_memory_preserve_hint_for_command_like_blocks(tmp_path) -> None:
    memory = JobMemory.empty(tmp_path / "job-memory.json")
    batch = [
        {
            "item_id": "p002-b003",
            "source_text": "$ uv venv deeph --python=3.13\n$ source deeph/bin/activate",
            "protected_source_text": "$ uv venv deeph --python=3.13\n$ source deeph/bin/activate",
        }
    ]
    translated = {
        "p002-b003": {
            "translated_text": "$ uv venv deeph --python=3.13\n$ source deeph/bin/activate",
        }
    }

    changed = update_job_memory_from_batch(memory, batch=batch, translated=translated)

    assert changed == 1
    summary = memory.prompt_summary()
assert "Technical source text/code/Parameter block" in summary
    assert "$ uv venv deeph" in summary


def test_job_memory_store_persists_json(tmp_path) -> None:
    store = JobMemoryStore(tmp_path / "translated" / "job-memory.json")
    batch = [
        {
            "item_id": "p001-b001",
            "source_text": "Self-consistent field (SCF) iterations.",
            "protected_source_text": "Self-consistent field (SCF) iterations.",
        }
    ]
    translated = {
        "p001-b001": {
            "translated_text": "Self-consistent field (SCF) iteration.",
        }
    }

    assert store.update_from_batch(batch, translated) >= 1
assert "SCF => self-consistent field" in store.summary()


def test_job_memory_store_allows_concurrent_writers_to_same_path(tmp_path) -> None:
    path = tmp_path / "translated" / "job-memory.json"

    def _write(index: int) -> int:
        store = JobMemoryStore(path)
        batch = [
            {
                "item_id": f"p001-b{index:03d}",
                "source_text": f"Self-consistent field (SCF) iteration {index}.",
                "protected_source_text": f"Self-consistent field (SCF) iteration {index}.",
            }
        ]
        translated = {
            f"p001-b{index:03d}": {
"translated_text": f"self-consistent field (SCF) iteration {index}.",
            }
        }
        return store.update_from_batch(batch, translated)

    with ThreadPoolExecutor(max_workers=8) as executor:
        changed = list(executor.map(_write, range(24)))

    assert sum(changed) >= 1
assert "SCF => self-consistent field" in JobMemoryStore(path).summary()
    assert not list(path.parent.glob("job-memory.json.tmp-*"))


def test_job_memory_prompt_summary_filters_sentence_fragments(tmp_path) -> None:
    memory = JobMemory.empty(tmp_path / "job-memory.json")
    memory.add_term(key="DFTB", value="density functional tight binding", source="p001-b001")
    memory.add_term(key="BJ", value="Corresponding system already fromDFTB3-D3", source="p001-b002")
    memory.add_term(key="GFN2-xTB", value="GFN2-xTB", source="p001-b003")

    summary = memory.prompt_summary()

assert "DFTB => density functional tight binding" in summary
    assert "GFN2-xTB => GFN2-xTB" in summary
    assert "BJ =>" not in summary


def test_job_memory_prompt_summary_for_source_only_returns_relevant_terms(tmp_path) -> None:
    memory = JobMemory.empty(tmp_path / "job-memory.json")
memory.add_term(key="SCF", value="self-consistent field", source="p001-b001")
memory.add_term(key="DFTB", value="density functional tight binding", source="p001-b002")
    memory.add_term(key="CAMM", value="Cumulative atomic multipole moments", source="p001-b003")

    summary = memory.prompt_summary_for_source("The SCF procedure computes molecular orbitals.")

assert "SCF => self-consistent field" in summary
    assert "DFTB =>" not in summary
    assert "CAMM =>" not in summary


def test_job_memory_store_summary_for_batch_only_returns_relevant_terms(tmp_path) -> None:
    store = JobMemoryStore(tmp_path / "translated" / "job-memory.json")
    memory = JobMemory.empty(store.path)
memory.add_term(key="SCF", value="self-consistent field", source="p001-b001")
memory.add_term(key="DFTB", value="density functional tight binding", source="p001-b002")
    store.save(memory)

    summary = store.summary_for_batch(
        [
            {
                "item_id": "p010-b004",
                "source_text": "This paragraph discusses DFTB approximations.",
            }
        ]
    )

assert "DFTB => density functional tight binding" in summary
    assert "SCF =>" not in summary


def test_job_memory_snapshot_is_read_only_point_in_time(tmp_path) -> None:
    store = JobMemoryStore(tmp_path / "translated" / "job-memory.json")
    memory = JobMemory.empty(store.path)
memory.add_term(key="SCF", value="self-consistent field", source="p001-b001")
    store.save(memory)
    snapshot = JobMemorySnapshot.from_store(store)

    store.update_from_batch(
        [{"item_id": "p002-b001", "source_text": "DFTB", "protected_source_text": "DFTB"}],
        {"p002-b001": {"translated_text": "Density Functional Tight Binding (DFTB）"}},
    )

    assert "SCF => self-consistent field" in snapshot.summary_for_batch([{"source_text": "SCF"}])
    assert "DFTB =>" not in snapshot.summary_for_batch([{"source_text": "DFTB"}])


def test_term_candidate_extraction_exposes_scores_without_breaking_tuple_api() -> None:
    candidates = extract_scored_term_candidates(
        "Color centers are also called F-centers.",
        "Lust (F-centers) also known as F-centers。",
    )

    assert candidates
    explicit = candidates[0]
    assert explicit.key == "F-centers"
assert explicit.value == "color center"
    assert explicit.source == "explicit_pair"
    assert explicit.score >= 1.0
