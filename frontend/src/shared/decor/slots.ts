// Registry neo trang trí (slot): "hợp đồng bố cục" của chủ đề trang trí.
//
// Nguyên tắc thiết kế (docs/theme-system/DECOR_PACKS.md):
// - UI chức năng luôn là DOM; lớp trang trí chỉ được mount trên các neo có tên bên dưới, không tự tạo tọa độ.
// - Manifest khai báo "tài nguyên gắn vào slot nào"; vị trí, kích thước và tầng của slot do
//   CSS sân khấu (DecorStage về sau) triển khai thống nhất; tách phía tài nguyên khỏi phía bố cục.
// - Thêm neo = đăng ký tại đây + thêm một quy tắc định vị trong CSS sân khấu; xác thực manifest tự cho phép.
//
// Dải tầng (z-index band, giá trị cụ thể do CSS sân khấu phân bổ thống nhất):
//   bg < nền UI chức năng < mid < nội dung UI chức năng … cạnh ngoài < fg.
//   bg  Nền toàn khung (sơn thủy/vườn/cao nguyên), luôn bị panel UI che.
//   mid  Đạo cụ trung cảnh (nhân vật/đỉnh đồng/ngựa), có thể bị panel UI che một phần.
//   fg  Tiền cảnh đè cạnh (cành hoa/tượng rồng vươn vào cạnh UI), pointer-events:none.

export type DecorLayerBand = "bg" | "mid" | "fg";

export type DecorSlotDefinition = {
  /** ID được manifest.layers[].slot tham chiếu. */
  id: string;
  band: DecorLayerBand;
  /** Vùng ước lượng (ngữ nghĩa phần trăm chỉ để gợi ý tài liệu, nguồn sự thật nằm trong CSS sân khấu). */
  area: string;
  /** true = cho phép đè lên cạnh UI chức năng (chỉ dải fg có thể là true). */
  overUi: boolean;
  /** true = slot hỗ trợ văn bản dọc/ngang (biểu ngữ đề chữ). */
  textCapable?: boolean;
};

/**
 * Bảng nguồn sự thật của neo. Bao quanh panel thư viện trung tâm + nền toàn khung + vị trí đề chữ.
 * Yếu tố trang trí của ba bản ý tưởng (phong cách Trung Hoa/vườn/cao nguyên) đều có thể ánh xạ vào bộ neo này.
 */
export const DECOR_SLOTS: readonly DecorSlotDefinition[] = [
  { id: "backdrop", band: "bg", area: "Toàn màn hình 100%×100%", overUi: false },

  // Hai cánh trái/phải: nhân vật, tượng rồng, bình sứ, ngựa, giá chim ưng trong bản ý tưởng.
  { id: "left-top", band: "mid", area: "Trên trái 0~25% × 0~40%", overUi: false },
  { id: "left-bottom", band: "mid", area: "Dưới trái 0~25% × 55~100%", overUi: false },
  { id: "right-top", band: "mid", area: "Trên phải 75~100% × 0~40%", overUi: false },
  { id: "right-bottom", band: "mid", area: "Dưới phải 75~100% × 55~100%", overUi: false },

  // Giữa phía trên: trang trí vòm/bướm/chim bay phía trên điều hướng.
  { id: "top-center", band: "mid", area: "Phía trên 30~70% × 0~12%", overUi: false },

  // Vị trí nhân vật chính: nhân vật ở vùng biểu ngữ trên (thiếu nữ/thiếu niên đọc sách trong ba bản ý tưởng).
  { id: "hero", band: "mid", area: "Vùng biểu ngữ trên 40~70% × 10~30%", overUi: false },

  // Tiền cảnh đè cạnh: cành hoa, chuỗi ngọc, tua rua vươn vào cạnh panel.
  { id: "edge-left", band: "fg", area: "Cạnh trái 0~12% × toàn chiều cao", overUi: true },
  { id: "edge-right", band: "fg", area: "Cạnh phải 88~100% × toàn chiều cao", overUi: true },

  // Vị trí tiền cảnh dưới phải: bản fg của right-bottom, dùng khi nhân vật/đạo cụ cần đè lên panel.
  { id: "right-bottom-fg", band: "fg", area: "Dưới phải 75~100% × 55~100%", overUi: true },

  // Biểu ngữ đề chữ ("Biết nơi mình đến, hiểu nơi mình đi"): vị trí văn bản dọc.
  { id: "quote", band: "mid", area: "Trên phải 82~98% × 5~35%", overUi: false, textCapable: true },
] as const;

export type DecorSlotId = (typeof DECOR_SLOTS)[number]["id"];

const SLOT_MAP: ReadonlyMap<string, DecorSlotDefinition> = new Map(
  DECOR_SLOTS.map((s) => [s.id, s]),
);

export function getDecorSlot(id: string): DecorSlotDefinition | undefined {
  return SLOT_MAP.get(id);
}

export function isDecorSlotId(value: unknown): value is DecorSlotId {
  return typeof value === "string" && SLOT_MAP.has(value);
}
