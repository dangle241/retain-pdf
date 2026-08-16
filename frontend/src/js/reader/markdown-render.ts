import { resolveMarkedVendorUrl } from "../runtime/vendor-url.js";

// Kết xuất Markdown an toàn chuyên cho câu trả lời AI: tải lười marked và **escape HTML thô**;
// `**in đậm**`/`## tiêu đề`/danh sách từ mô hình được kết xuất, nhưng `<img>`/`<script>` luôn hiển thị thành
// văn bản literal và không bao giờ vào DOM để chống injection. Việc chèn nút trích dẫn tách khỏi mô-đun này (xem chat.js).

let markedPromise = null;

function escapeHtml(value = "") {
  return `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Các phiên bản marked có tham số renderer.html khác nhau (chuỗi hoặc token); thống nhất lấy nội dung gốc rồi escape.
function rawHtmlText(input) {
  if (typeof input === "string") {
    return input;
  }
  return `${input?.raw ?? input?.text ?? ""}`;
}

function loadMarked() {
  if (!markedPromise) {
    markedPromise = import(resolveMarkedVendorUrl())
      .then(({ marked, Marked }) => {
        // Dùng instance độc lập để không làm bẩn cấu hình marked toàn cục của markdown-preview.
        const instance = typeof Marked === "function" ? new Marked() : marked;
        instance.use({
          renderer: {
            html: (input) => escapeHtml(rawHtmlText(input)),
          },
        });
        return instance;
      })
      .catch((error) => {
        markedPromise = null;
        throw error;
      });
  }
  return markedPromise;
}

// Văn bản Markdown → DocumentFragment đã làm sạch. Ném lỗi khi marked không khả dụng, như trong test node,
// bên gọi chịu trách nhiệm lùi về nút văn bản thuần.
export async function renderAiMarkdownFragment(text, { documentRef = globalThis.document } = {}) {
  const marked = await loadMarked();
  const template = documentRef.createElement("template");
  template.innerHTML = marked.parse(`${text || ""}`, { async: false });
  // Bảo vệ kép: ngay cả khi renderer.html bỏ sót, vẫn xóa nút dạng script và sự kiện nội tuyến/liên kết nguy hiểm.
  const content = template.content;
  content.querySelectorAll("script, iframe, object, embed, img, svg").forEach((node) => node.remove());
  content.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  content.querySelectorAll("a[href]").forEach((anchor) => {
    if (/^\s*javascript:/i.test(anchor.getAttribute("href") || "")) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
  return content;
}
