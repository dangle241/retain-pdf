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

// Render artifacts originate solely from local pipeline.,Base cleanup layer here.:
// Remove script nodes, inline events, and javascript: links
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

  // Backend images required. X-API-Key,<img> Cannot send request headers,Switch to blob URL。
  // src Saved before mount. data-reader-md-src,Preflight. Add `Access-Control-Allow-Headers` + `Access-Control-Allow-Methods` to OPTIONS response.
  async function hydrateImages(container) {
    const images = [...container.querySelectorAll("img[data-reader-md-src]")];
    await Promise.allSettled(images.map(async (img) => {
      const src = img.getAttribute("data-reader-md-src") || "";
      try {
        const response = await fetchProtected?.(src);
        if (!response?.ok) {
          throw new Error(`Image load failed(${response?.status ?? "Network error"})`);
        }
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrls.push(objectUrl);
        img.src = objectUrl;
      } catch (_err) {
        const fallback = img.ownerDocument.createElement("span");
        fallback.className = "reader-markdown-image-missing";
        fallback.textContent = `[Image temporarily unavailable] ${img.getAttribute("alt") || src}`;
        fallback.title = src;
        img.replaceWith(fallback);
      }
    }));
  }

  async function load() {
    setStatus("Loading Markdown…");
    const payload = await loadMarkdownPayload?.(jobId);
    const content = `${payload?.content_with_absolute_image_urls || payload?.content || ""}`;
    const imagesBaseUrl = `${payload?.images_base_url || payload?.images_base_path || ""}`.trim();
    if (!content.trim()) {
setStatus("This task currently has no Markdown output");
      return false;
    }
    const { marked } = await loadMarked();
    const container = contentEl();
    if (!container) {
      return false;
    }
// Protect first $Formula$ then marked and MathJaxâSVGImage path missing. Remove template before mounting src
    const html = await parseMarkdownWithMath(content, (src) =>
      String(marked.parse(src, { async: false })),
    );
    const template = container.ownerDocument.createElement("template");
    template.innerHTML = html;
    sanitizeRenderedMarkdown(template.content);
// Dynamic import to avoid circular dependency; resolveMarkdownAssetUrl strips images/ double prefix
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
        setStatus(error?.message || "Markdown Load failed. Reopen drawer to retry.");
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
