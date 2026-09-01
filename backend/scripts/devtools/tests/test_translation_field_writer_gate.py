from __future__ import annotations

import ast
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.architecture_checks.translation_field_writers import (
    check_translation_payload_field_writers,
    gated_field_writes,
)


def _writes(source: str) -> dict[str, list[int]]:
    return gated_field_writes(ast.parse(source))


def test_detects_subscript_assignment_regardless_of_variable_name() -> None:
    # 门禁必须与变量名无关:item / metadata / record 都要抓到。
    source = (
        "item[\"final_status\"] = \"translated\"\n"
        "metadata[\"translated_text\"] = output\n"
        "record[\"should_translate\"] = False\n"
    )

    writes = _writes(source)

    assert writes == {
        "final_status": [1],
        "translated_text": [2],
        "should_translate": [3],
    }


def test_detects_setdefault_and_tuple_targets() -> None:
    source = (
        "payload.setdefault(\"skip_reason\", \"\")\n"
        "a[\"translated_text\"], b[\"protected_translated_text\"] = x, y\n"
    )

    writes = _writes(source)

    assert writes == {
        "skip_reason": [1],
        "translated_text": [2],
        "protected_translated_text": [2],
    }


def test_ignores_reads_and_ungated_keys() -> None:
    source = (
        "value = item[\"final_status\"]\n"
        "item[\"bbox\"] = [0, 0, 1, 1]\n"
        "flag = item.get(\"should_translate\", True)\n"
    )

    assert _writes(source) == {}


def test_current_tree_has_no_violations() -> None:
    # 全量跑真实 translation 目录:allowlist 必须与现状精确一致。
    # 若此测试失败,要么出现了新的越界写入(修代码),
    # 要么完成了一次收敛(从 allowlist 删掉对应 frozen-debt 条目)。
    errors: list[str] = []

    check_translation_payload_field_writers(errors)

    assert errors == []
