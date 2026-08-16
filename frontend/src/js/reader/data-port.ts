import { API_PREFIX } from "../config/api-constants.js";
import {
  fetchJobPayload,
} from "../api/jobs-query.js";
import {
  fetchJobArtifactsManifest,
  fetchJobMarkdown,
  fetchJobMarkdownDocument,
} from "../api/jobs-artifacts.js";
import { fetchProtected } from "../api/http.js";
import {
  fetchReaderAiChat,
  fetchReaderMetadata,
  fetchReaderRegions,
} from "../api/reader.js";
import {
  fetchTranslationItem,
} from "../api/translation-debug.js";

export function createReaderDataPort({
  apiPrefix = API_PREFIX,
  loadJob = fetchJobPayload,
  loadManifest = fetchJobArtifactsManifest,
  loadMarkdown = fetchJobMarkdown,
  loadMarkdownDocument = fetchJobMarkdownDocument,
  loadAiChat = fetchReaderAiChat,
  loadRegions = fetchReaderRegions,
  loadMetadata = fetchReaderMetadata,
  loadTranslationItem = fetchTranslationItem,
  fetchProtectedResource = fetchProtected,
} = {}) {
  async function loadReaderPayload(jobId) {
    const [jobPayload, manifestPayload, regionsPayload, readerMetadata] = await Promise.all([
      loadJob(jobId, apiPrefix),
      loadManifest(jobId, apiPrefix),
      loadRegions(jobId, apiPrefix).catch(() => ({ items: [] })),
      loadMetadata(jobId, apiPrefix).catch(() => null),
    ]);
    return {
      jobPayload,
      manifestPayload,
      readerMetadata,
      regionsPayload,
    };
  }

  function fetchRegionTranslationItem(jobId, itemId) {
    return loadTranslationItem(jobId, itemId, apiPrefix);
  }

  // Ưu tiên /markdown/document vì có content_with_absolute_image_urls; ảnh có thể được lấy có xác thực qua địa chỉ API.
  // /markdown chỉ có images/... tương đối; trên trang reader sẽ phân giải tới nguồn tĩnh 404 → "Ảnh tạm thời không khả dụng".
  async function loadMarkdownPayload(jobId) {
    try {
      const documentPayload = await loadMarkdownDocument(jobId, apiPrefix);
      if (documentPayload) {
        return documentPayload;
      }
    } catch (_err) {
      /* fall through */
    }
    return loadMarkdown(jobId, apiPrefix);
  }

  function submitAiChat(jobId, payload) {
    return loadAiChat(jobId, payload, apiPrefix);
  }

  return Object.freeze({
    apiPrefix,
    fetchProtected: fetchProtectedResource,
    fetchRegionTranslationItem,
    loadMarkdownPayload,
    loadReaderPayload,
    submitAiChat,
  });
}

export const defaultReaderDataPort = createReaderDataPort();
