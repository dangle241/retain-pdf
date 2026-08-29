from __future__ import annotations

import json

from services.translation.llm.shared.orchestration.segment_plan import segment_context_text
from services.translation.llm.shared.orchestration.segment_plan import segment_structure_outline


def segment_translation_system_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "Bạn đang dịch các đoạn văn bản cố định được trích xuất từ một mục OCR khoa học.\n"
        "Mỗi đoạn là một đoạn ngôn ngữ tự nhiên nằm giữa các công thức được bảo vệ hoặc token nguyên văn.\n"
        "Các công thức/nguyên văn được bảo vệ đó được bỏ khỏi yêu cầu và sẽ được chèn lại tự động bằng phần mềm sau khi dịch.\n"
        "Bạn KHÔNG dịch toàn bộ mục như một câu. Bạn dịch từng đoạn được cung cấp một cách độc lập trong khi tôn trọng thứ tự đoạn gốc.\n"
        "Sử dụng tiếng Trung giản thể ngắn gọn theo phong cách xuất bản phù hợp với văn bản khoa học.\n"
        "Giữ các từ viết tắt, ký hiệu và tên mô hình chuẩn ở dạng kỹ thuật bình thường của chúng.\n"
        "Nếu một đoạn chỉ là một connector hoặc cụm từ chưa hoàn chỉnh, giữ nó ngắn và chưa hoàn chỉnh như nhau trong tiếng Trung.\n"
        "Không sửa chữa ngữ pháp bị cắt ngắn bằng cách lấy nội dung từ các đoạn lân cận.\n"
        "Không xuất ra bất kỳ placeholder công thức, marker công thức, văn bản mục đầy đủ được tái tạo, bình luận, markdown hay code fences nào.\n"
        'Chỉ trả về JSON khớp với {"segments":[{"segment_id":"1","translated_text":"..."}]}.\n'
        "Quy tắc cứng:\n"
        "- Mỗi segment_id được yêu cầu phải xuất hiện chính xác một lần.\n"
        "- Không gộp, tách, bỏ sót, đổi số, đổi thứ tự hay tạo đoạn giả.\n"
        "- Không sao chép công thức ẩn lại vào đầu ra dưới bất kỳ hình thức nào.\n"
        "- Các connector ngắn như 'and', 'for', 'with' hay 'by considering the possible' phải giữ nguyên tính gọn gàng thay vì mở rộng thành câu hoàn chỉnh."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nHướng dẫn dịch thuật theo tài liệu:\n{domain_guidance.strip()}"
    return prompt


def segment_translation_tagged_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "Bạn đang dịch các đoạn văn bản cố định được trích xuất từ một mục OCR khoa học.\n"
        "Mỗi đoạn là một đoạn ngôn ngữ tự nhiên độc lập nằm giữa các công thức được bảo vệ hoặc nguyên văn.\n"
        "Các công thức được bảo vệ được bỏ qua và sẽ được chèn lại bởi phần mềm sau khi dịch.\n"
        "Dịch từng đoạn một cách độc lập thành tiếng Trung giản thể ngắn gọn theo phong cách xuất bản.\n"
        "Không gộp, tách, bỏ sót, đổi thứ tự hay đổi số các đoạn.\n"
        "Không xuất ra công thức, markdown, bình luận, code fences hay văn bản mục đầy đủ được tái tạo.\n"
        "Trả về một khối tagged cho mỗi đoạn theo định dạng chính xác này:\n"
        "<<<SEG id=1>>>\n"
        "văn bản dịch\n"
        "<<<END>>>\n"
        "Xuất một khối cho mỗi segment_id được yêu cầu chính xác một lần."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nHướng dẫn dịch thuật theo tài liệu:\n{domain_guidance.strip()}"
    return prompt


def build_formula_segment_messages(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    domain_guidance: str = "",
    context_before: str | None = None,
    context_after: str | None = None,
    response_style: str = "tagged",
) -> list[dict[str, str]]:
    serialized_segments = [
        {"segment_id": segment["segment_id"], "source_text": segment["source_text"]}
        for segment in segments
    ]
    user_payload: dict[str, object] = {
        "item_id": item["item_id"],
        "segment_count": len(serialized_segments),
        "segment_structure": segment_structure_outline(skeleton),
        "segments": serialized_segments,
    }
    include_continuation_context = str(item.get("translation_context_mode", "needed") or "needed").strip().lower() != "off"
    resolved_context_before = (
        context_before
        if context_before is not None
        else segment_context_text(str(item.get("continuation_prev_text", "") or "") if include_continuation_context else "")
    )
    resolved_context_after = (
        context_after
        if context_after is not None
        else segment_context_text(str(item.get("continuation_next_text", "") or "") if include_continuation_context else "")
    )
    if resolved_context_before:
        user_payload["context_before"] = resolved_context_before
    if resolved_context_after:
        user_payload["context_after"] = resolved_context_after
    if item.get("continuation_group"):
        user_payload["continuation_group"] = item["continuation_group"]
    system_prompt = (
        segment_translation_system_prompt(domain_guidance=domain_guidance)
        if response_style == "json"
        else segment_translation_tagged_prompt(domain_guidance=domain_guidance)
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]
