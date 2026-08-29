from __future__ import annotations


class SuspiciousKeepOriginError(ValueError):
    def __init__(self, item_id: str, result: dict[str, dict[str, str]]) -> None:
        super().__init__(f"{item_id}: keep_origin đáng ngờ cho đoạn văn bản tiếng Anh dài")
        self.item_id = item_id
        self.result = result


class UnexpectedPlaceholderError(ValueError):
    def __init__(
        self,
        item_id: str,
        unexpected: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: placeholder không mong đợi trong bản dịch: {unexpected}")
        self.item_id = item_id
        self.unexpected = unexpected
        self.source_text = source_text
        self.translated_text = translated_text


class PlaceholderInventoryError(ValueError):
    def __init__(
        self,
        item_id: str,
        source_sequence: list[str],
        translated_sequence: list[str],
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(
            f"{item_id}: kiểm kê placeholder không khớp: nguồn={source_sequence} dịch={translated_sequence}"
        )
        self.item_id = item_id
        self.source_sequence = source_sequence
        self.translated_sequence = translated_sequence
        self.source_text = source_text
        self.translated_text = translated_text


class EmptyTranslationError(ValueError):
    def __init__(self, item_id: str) -> None:
        super().__init__(f"{item_id}: đầu ra bản dịch trống")
        self.item_id = item_id


class EnglishResidueError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: đầu ra dịch vẫn trông chủ yếu là tiếng Anh")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class TranslationProtocolError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: đầu ra dịch vẫn chứa vỏ giao thức/json")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class MathDelimiterError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
    ) -> None:
        super().__init__(f"{item_id}: đầu ra dịch có dấu phân cách toán học nội dòng không cân bằng")
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text


class TruncatedTranslationError(ValueError):
    def __init__(
        self,
        item_id: str,
        *,
        source_text: str = "",
        translated_text: str = "",
        ratio: float = 0.0,
    ) -> None:
        super().__init__(
            f"{item_id}: đầu ra dịch ngắn bất thường so với nguồn (tỷ lệ={ratio:.3f})"
        )
        self.item_id = item_id
        self.source_text = source_text
        self.translated_text = translated_text
        self.ratio = ratio


__all__ = [
    "EmptyTranslationError",
    "EnglishResidueError",
    "MathDelimiterError",
    "PlaceholderInventoryError",
    "SuspiciousKeepOriginError",
    "TranslationProtocolError",
    "TruncatedTranslationError",
    "UnexpectedPlaceholderError",
]
