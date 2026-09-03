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

  // Prefer /markdown/document: includes content_with_absolute_image_urls so images can be fetched with API auth.
  // /markdown only has relative images/... which resolves to static 404 on reader page → "Image is not ready".
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




