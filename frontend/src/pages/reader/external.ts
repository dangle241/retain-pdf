// Reader "New Engine / Shared layer" exports to src/js/*.
//
// For internal use only in pages/reader non-legacy paths:
//   hooks/、pdf/、annotations/、components/react-pdf/、ReaderAppReactPdf
// Missing symbol. Fix in this file only.
//
// legacy/** and ?engine=legacy awaiting source text. Import js/reader imperative engine.
// （pdf-controller / selection-favorites / regions…）——Don't cram them here.

// —— config / mock / messaging ——
export { isMockMode } from "../../js/config/runtime.js";
export { MOCK_DOCUMENT_SOURCE_PDF_URL } from "../../js/mock/documents.js";
export { READER_DIALOG_MESSAGES } from "../../js/features/reader-dialog/contract.js";

// —— job / http / vendor ——
export { resolveResourceUrl } from "../../js/job/artifacts.js";
export { fetchProtected } from "../../js/api/http.js";
export {
  resolvePdfjsVendorUrl,
  resolveMarkedVendorUrl,
} from "../../js/runtime/vendor-url.js";

// ââ js/reader shared ports; new engine allows subset dependencies ââ
export { defaultReaderDataPort } from "../../js/reader/data-port.js";
export {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "../../js/reader/config-port.js";
export { resolveReaderArtifactUrl } from "../../js/reader/pdf-document.js";
export {
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "../../js/reader/resource-resolver.js";
export { READER_PROGRESS_COPY } from "../../js/reader/page-state.js";

// —— Download (and legacy Shared parsing / Protected download)——
export {
  READER_DOWNLOAD_ACTIONS,
  disabledReason as readerDownloadDisabledReason,
  resolveReaderDownloadName,
  resolveReaderDownloadUrls,
  trimString as trimReaderDownloadString,
} from "../../js/reader/downloads/resolve.js";
export { downloadProtectedResource } from "../../js/features/reader-dialog/downloads.js";
export { failDownloadToast } from "../../js/utils/download-feedback.js";

// ââ markdown panel ââ
export { resolveMarkdownAssetUrl } from "../../js/job/artifacts.js";
export { parseMarkdownWithMath } from "../../js/reader/markdown-math.js";

// —— AI Follow-up (react-pdf assistant）——
export { createReaderAskAnswerer } from "../../js/reader/ai/ask-answerer.js";
export { createReaderMarkdownAnswerer } from "../../js/reader/ai/markdown-answerer.js";
export {
  hydrateProtectedImages,
  injectCitationMarkers,
  isAgenticCitation,
  neutralizeMarkdownAnchors,
  renderCitationFooter,
  revokeHydratedImageUrls,
} from "../../js/reader/ai/answer-enhance.js";
export type { AiCitationLike } from "../../js/reader/ai/answer-enhance.js";
export {
  armReaderAiClickShield,
  clearReaderAiNavigationLock,
  installReaderWindowOpenGuard,
  isReaderAiNavigationLocked,
  lockReaderAiNavigation,
  shouldIgnoreReaderAiNavEvent,
} from "../../js/reader/ai/ui-interaction-lock.js";
export {
  peekFinalAnswerHtmlCache,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
} from "../../js/reader/ai/render-answer-html.js";
export { sanitizeAssistantAnswer } from "../../js/reader/ai/sanitize-answer.js";
export {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "../../js/reader/ai/thread-branch-store.js";
export type {
  ThreadBranchCitation,
  ThreadBranchItem,
  ThreadBranchMessage,
  ThreadBranchSnapshot,
} from "../../js/reader/ai/thread-branch-store.js";
export {
  appendConversationMessage,
  baseConversationTitle,
  createConversation,
  deleteConversation,
  forkConversationFromPath,
  getConversation,
  listConversations,
  messagesToBranchItems,
  nextForkConversationTitle,
  patchConversation,
} from "../../js/api/conversations.js";
export type {
  ConversationDetail,
  ConversationRecord,
  MessageRecord,
} from "../../js/api/conversations.js";
export {
  loadStoredConversationId,
  saveStoredConversationId,
  clearStoredConversationId,
} from "../../js/reader/ai/conversation-store.js";

// —— Server-side favorites panel ——
export { API_PREFIX } from "../../js/config/api-constants.js";
export { fetchFavorites } from "../../js/api/favorites.js";
export {
  createReaderServerFavoritesPort,
  normalizeServerFavorite,
} from "../../js/reader/server-favorites-port.js";
export type { ServerFavorite } from "../../js/reader/types.js";
