from __future__ import annotations


def format_translation_progress_message(
    current: int,
    total: int,
    touched_pages: set[int],
    *,
    substage: str = "translation_batches",
) -> str:
    if touched_pages:
        sorted_pages = sorted(page_idx + 1 for page_idx in touched_pages)
        if len(sorted_pages) == 1:
            page_suffix = f"（trang gần nhất: {sorted_pages[0]}）"
        else:
            preview = ",".join(str(page) for page in sorted_pages[:4])
            if len(sorted_pages) > 4:
                preview = f"{preview}..."
            page_suffix = f"（trang gần nhất: {preview}）"
    else:
        page_suffix = ""
    if substage == "translation_tail_retry":
        return f"Đang xử lý hàng đợi thử lại dịch, thứ {current}/{total} mục{page_suffix}"
    return f"Đã hoàn thành thứ {current}/{total} lô dịch{page_suffix}"


__all__ = ["format_translation_progress_message"]
