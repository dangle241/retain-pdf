// Định nghĩa công cụ trình đọc (căn với bộ bốn công cụ thanh trên legacy + tải xuống ở vùng FAB riêng).

export type ReaderToolId = "notes" | "favorites" | "markdown" | "ai";

export type ReaderToolDef = {
  id: ReaderToolId;
  label: string;
  /** Nội dung phụ (tắt / bật). */
  subIdle: string;
  subOpen: string;
  /** Có vô hiệu hóa khi tài liệu nguồn chỉ đọc hay không. */
  needsJob: boolean;
};

/** Cùng bộ khả năng với ReaderTopbarActions.TOOL_BUTTONS legacy. */
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "notes",
    label: "Chú thích",
    subIdle: "Chọn văn bản rồi thêm",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: false,
  },
  {
    id: "favorites",
    label: "Trích đoạn",
    subIdle: "Mục đã lưu trên đám mây của sách này",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "Văn bản nhận dạng / bản dịch",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: true,
  },
  {
    id: "ai",
    label: "Hỏi đáp AI",
    subIdle: "Đặt câu hỏi dựa trên tài liệu",
    subOpen: "Đóng cửa sổ nổi",
    needsJob: true,
  },
]);
