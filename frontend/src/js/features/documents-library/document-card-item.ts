// 文档中心网格的卡片 item 形状(计划 wondrous-baking-donut.md 的 F2)。
//
// 设计要点(见 memory f2-document-centric-grid-design):图书馆网格改成"每篇文档
// 一张卡",但底层复用 features/recent-jobs 那套按 job_id 键控的 store/去重/轮询
// 引擎(一行不改)。于是:
// - 已翻译文档(active_job_id 非空):卡片带真实 job_id,并把 library/books 的实时
//   status/stage/progress/cover 合并进来 → 现有轮询/进度/封面机制原样接管。
// - 馆藏文档(active_job_id 为 null/空):给一个**合成命名空间 job_id**
//   `doc:<document_id>`,让它能原样穿过按 job_id 去重的 dedupeRecentJobs / store,
//   不被"空 job_id 直接丢弃"的逻辑滤掉;卡片靠 library_only 布尔分支馆藏态
//   (禁用对照阅读、显示"未翻译"、走翻译/读原文),不去解析这个合成 id。

import { flattenStageSnapshot } from "../../job/stage-snapshot-flatten.js";

export const LIBRARY_ONLY_JOB_PREFIX = "doc:";

export function syntheticLibraryJobId(documentId) {
  const normalized = `${documentId || ""}`.trim();
  return normalized ? `${LIBRARY_ONLY_JOB_PREFIX}${normalized}` : "";
}

export function isLibraryOnlyItem(item: any = {}) {
  return item?.library_only === true;
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const url = `${candidate || ""}`.trim();
    if (url) {
      return url;
    }
  }
  return "";
}

/** book 标题若是 job_id / job_id.pdf / Mock…，改用文档真名 */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
    || /^Mock(\s|重试|-|_)/i.test(book)
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + 可选的 library/books 投影 → 一张网格卡片 item。
// book 命中(已翻译)时以 book 的活态字段为主,叠加文档身份(document_id、
// reading_status、tags、source_pdf_url);book 缺失时按文档字段构造馆藏卡。
export function shapeDocumentCardItem(document: any = {}, book = null) {
  const documentId = `${document.document_id || ""}`.trim();
  const activeJobId = `${document.active_job_id || ""}`.trim();
  const sharedDocFields = {
    document_id: documentId,
    reading_status: document.reading_status || "",
    tags: Array.isArray(document.tags) ? document.tags : [],
    source_pdf_url: document.source_pdf_url || "",
    bytes: document.bytes,
    added_at: document.added_at || "",
    last_opened_at: document.last_opened_at || null,
  };

  if (activeJobId && book && typeof book === "object") {
    // 已翻译:以 library/books 活态为主(与现网格视觉一致),补齐文档身份与
    // 封面兜底(合成 book 可能不带 cover_url,回退到文档级 cover)。
    const flattened = flattenStageSnapshot(book);
    const jobId = `${flattened.job_id || book.job_id || activeJobId}`.trim();
    return {
      ...flattened,
      ...sharedDocFields,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
      // 封面/页数：book 活态优先、文档级兜底（与现网格视觉一致）；
      // 标题：禁止 book 用 job_id.pdf 盖掉真书名
      cover_url: firstUrl(flattened.cover_url, book.cover_url, document.cover_url),
      thumbnail_url: firstUrl(flattened.thumbnail_url, book.thumbnail_url, document.thumbnail_url),
      page_count: document.page_count || flattened.page_count || 0,
      updated_at: flattened.updated_at || document.updated_at || "",
      title: pickCardTitle(flattened.title || book.title, document, jobId),
      display_name: pickCardTitle(
        flattened.display_name || flattened.title || book.display_name || book.title,
        document,
        jobId,
      ),
    };
  }

  if (activeJobId) {
    // 有 active_job_id 但 library/books 没投影(少见边角:job 刚建/被清)。保留真实
    // job_id 让轮询/对照阅读仍可用,但没有成品活态,按未完成处理(reader 禁用)。
    return {
      ...sharedDocFields,
      job_id: activeJobId,
      active_job_id: activeJobId,
      library_only: false,
      status: "",
      title: document.title || document.source_filename || "",
      display_name: document.title || document.source_filename || "",
      source_file_name: document.source_filename || "",
      page_count: document.page_count || 0,
      cover_url: firstUrl(document.cover_url),
      thumbnail_url: firstUrl(document.thumbnail_url),
      updated_at: document.updated_at || "",
    };
  }

  // 馆藏态(未翻译):合成 job_id 让它穿过按 job_id 键控的引擎;library_only 打标。
  return {
    ...sharedDocFields,
    job_id: syntheticLibraryJobId(documentId),
    active_job_id: "",
    library_only: true,
    status: "",
    title: document.title || document.source_filename || "",
    display_name: document.title || document.source_filename || "",
    source_file_name: document.source_filename || "",
    page_count: document.page_count || 0,
    cover_url: firstUrl(document.cover_url),
    thumbnail_url: firstUrl(document.thumbnail_url),
    updated_at: document.updated_at || "",
  };
}
