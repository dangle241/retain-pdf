import { $ } from "../dom/query.js";
import { resolveMarkedVendorUrl } from "../runtime/vendor-url.js";
import { parseMarkdownWithMath } from "./markdown-math.js";

let markedModulePromise = null;

function loadMarked() {
  if (!markedModulePromise) {
    markedModulePromise = import(resolveMarkedVendorUrl())
      .catch((error) => {
        markedModulePromise = null;
        throw error;
      });
  }
  return markedModulePromise;
}

// Đầu ra kết xuất chỉ đến từ pipeline của site này nhưng vẫn làm sạch cơ bản tại đây:
// loại bỏ nút script, sự kiện nội tuyến và liên kết javascript:.
function sanitizeRenderedMarkdown(container) {
  container.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  container.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  container.querySelectorAll("a[href]").forEach((anchor) => {
    if (/^\s*javascript:/i.test(anchor.getAttribute("href") || "")) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
}

export function createReaderMarkdownPreview({
  jobId = "",
  loadMarkdownPayload = null,
  fetchProtected = null,
} = {}) {
  let loadPromise = null;
  const objectUrls = [];

  function statusEl() {
    return $("reader-markdown-status");
  }

  function contentEl() {
    return $("reader-markdown-content");
  }

  function setStatus(text) {
    const el = statusEl();
    if (el) {
      el.textContent = text || "";
      el.classList.toggle("hidden", !text);
    }
  }

  // Ảnh backend cần X-API-Key; <img> không gửi được header nên đổi sang blob URL.
  // src đã được chuyển sang data-reader-md-src trước khi gắn để trình duyệt không gửi yêu cầu trần trước.
  async function hydrateImages(container) {
    const images = [...container.querySelectorAll("img[data-reader-md-src]")];
    await Promise.allSettled(images.map(async (img) => {
      const src = img.getAttribute("data-reader-md-src") || "";
      try {
        const response = await fetchProtected?.(src);
        if (!response?.ok) {
          throw new Error(`Tải ảnh thất bại (${response?.status ?? "lỗi mạng"})`);
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.push(objectUrl);
        img.src = objectUrl;
      } catch (_err) {
        const fallback = img.ownerDocument.createElement("span");
        fallback.className = "reader-markdown-image-missing";
        fallback.textContent = `[Ảnh tạm thời không khả dụng] ${img.getAttribute("alt") || src}`;
        fallback.title = src;
        img.replaceWith(fallback);
      }
    }));
  }

  async function load() {
    setStatus("Đang tải Markdown…");
    const payload = await loadMarkdownPayload?.(jobId);
    const content = `${payload?.content_with_absolute_image_urls || payload?.content || ""}`;
    const imagesBaseUrl = `${payload?.images_base_url || payload?.images_base_path || ""}`.trim();
    if (!content.trim()) {
      setStatus("Tác vụ chưa có đầu ra Markdown");
      return false;
    }
    const { marked } = await loadMarked();
    const container = contentEl();
    if (!container) {
      return false;
    }
    // Bảo vệ $công thức$ trước marked rồi MathJax→SVG; xóa src của ảnh trong template trước khi gắn.
    const html = await parseMarkdownWithMath(content, (src) =>
      String(marked.parse(src, { async: false })),
    );
    const template = container.ownerDocument.createElement("template");
    template.innerHTML = html;
    sanitizeRenderedMarkdown(template.content);
    // Import động để tránh vòng; resolveMarkdownAssetUrl bỏ tiền tố images/ kép.
    const { resolveMarkdownAssetUrl } = await import("../job/artifacts.js");
    template.content.querySelectorAll("img[src]").forEach((img) => {
      const raw = img.getAttribute("src") || "";
      const resolved = resolveMarkdownAssetUrl(imagesBaseUrl, raw) || raw;
      img.setAttribute("data-reader-md-src", resolved);
      img.removeAttribute("src");
    });
    container.replaceChildren(template.content);
    container.classList.remove("hidden");
    setStatus("");
    await hydrateImages(container);
    return true;
  }

  function ensureLoaded() {
    if (!loadPromise) {
      loadPromise = load().catch((error) => {
        loadPromise = null;
        setStatus(error?.message || "Tải Markdown thất bại; hãy mở lại ngăn để thử lại");
        return false;
      });
    }
    return loadPromise;
  }

  function destroy() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.length = 0;
  }

  return {
    destroy,
    ensureLoaded,
  };
}
