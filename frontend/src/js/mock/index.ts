import { MOCK_JOB_ID } from "./constants.js";
import { buildMockManifest } from "./artifacts.js";
import { buildMockEvents } from "./events.js";
import { buildMockJobPayload } from "./job.js";
import { currentMockScenario } from "./scenario.js";
import {
  buildLiveMockJobEvents,
  buildLiveMockJobPayload,
  isLiveMockJobId,
  registerLiveMockJob,
} from "./live-jobs.js";
import { getMockDocumentByJobId } from "./documents.js";
import type { JobLike } from "../job/types.js";
import type { LibraryCardItem } from "../../pages/home/features/library/types.js";
export { getMockJobMarkdown } from "./markdown.js";
export { fetchMockProtected } from "./responses.js";
export {
  registerLiveMockJob,
  resetLiveMockJobs,
  isLiveMockJobId,
  isLiveMockJobActive,
} from "./live-jobs.js";

export function isMockScenarioEnabled() {
  return !!currentMockScenario();
}

export function getMockScenario() {
  return currentMockScenario();
}

export function getMockJobId() {
  return MOCK_JOB_ID;
}

function enrichJobWithDocument(job: JobLike | LibraryCardItem, jobId: string) {
  const doc = getMockDocumentByJobId(jobId);
  if (!doc) {
    return job;
  }
  return {
    ...job,
    document_id: doc.document_id || (job as LibraryCardItem).document_id,
    title: doc.title || (job as LibraryCardItem).title,
    display_name: doc.title || (job as LibraryCardItem).display_name,
    source_file_name: doc.source_filename || (job as LibraryCardItem).source_file_name,
    page_count: doc.page_count ?? (job as LibraryCardItem).page_count,
    cover_url: doc.cover_url || (job as LibraryCardItem).cover_url,
    thumbnail_url: doc.thumbnail_url || (job as LibraryCardItem).thumbnail_url,
  };
}

export function getMockJobPayload(jobId = ""): JobLike {
  const id = `${jobId || ""}`.trim();
  // 提交Translation产生的 live job: 按墙钟推进(详情 Tab Progress动画)
  const live = buildLiveMockJobPayload(id);
  if (live) {
    return enrichJobWithDocument(live, id) as JobLike;
  }
  // 主 mock job: 跟 URL ?mock= 场景
  if (!id || id === MOCK_JOB_ID) {
    return enrichJobWithDocument(buildMockJobPayload(), id || MOCK_JOB_ID) as JobLike;
  }
  // Documents中心合成的 active_job_id(如 20260520-att-001): 返回终态完整 payload, 
  // 让Book Details嵌入的 StatusCard 能拉到与真实成功 job 同形的Data(Stage流/产物就绪).
  const book = synthesizeMockBook(id);
  return {
    ...buildMockJobPayload("done"),
    ...book,
    job_id: id,
    status: "succeeded",
    stage: "finished",
    stage_detail: book.stage_detail || "任务Done",
  } as JobLike;
}

export function getMockJobEvents(jobId = "") {
  const id = `${jobId || ""}`.trim();
  if (isLiveMockJobId(id)) {
    return buildLiveMockJobEvents(id);
  }
  return buildMockEvents();
}

export function getMockJobArtifactsManifest() {
  return buildMockManifest();
}

// Documents中心Grid(F2)会用 library/books?job_ids= Batch取"Translated mock Documents"的活态.
// 优先从 mock Documents表取真书名/封面, 禁止再用 job_id.pdf 当Title(空封面Root Cause之一).
function synthesizeMockBook(jobId: string): LibraryCardItem {
  const doc = getMockDocumentByJobId(jobId);
  const title = doc?.title || doc?.source_filename || "TranslatedDocuments";
  return {
    id: jobId,
    job_id: jobId,
    document_id: doc?.document_id,
    title,
    display_name: title,
    source_file_name: doc?.source_filename || "",
    page_count: doc?.page_count ?? 12,
    cover_url: doc?.cover_url,
    thumbnail_url: doc?.thumbnail_url,
    status: "succeeded",
    stage: "finished",
    stage_detail: "任务Done",
    progress: { current: 12, total: 12, percent: 100, unit: "none" },
    output_pdf_ready: true,
    markdown_ready: true,
    bundle_ready: true,
    created_at: doc?.added_at || "2026-06-01T10:00:00Z",
    updated_at: doc?.updated_at || "2026-06-01T12:00:00Z",
  };
}

export interface MockJobListQuery {
  jobIds?: Array<string | null | undefined>;
}

export interface MockJobListResult {
  items: Array<JobLike | LibraryCardItem>;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function getMockJobList({ jobIds = [] }: MockJobListQuery = {}): MockJobListResult {
  if (Array.isArray(jobIds) && jobIds.length) {
    const wanted = jobIds.map((id) => `${id}`.trim()).filter(Boolean);
    const items = wanted.map((id) => {
      if (id === MOCK_JOB_ID) {
        return enrichJobWithDocument(buildMockJobPayload(), id);
      }
      const live = buildLiveMockJobPayload(id);
      if (live) {
        return enrichJobWithDocument(live, id);
      }
      return synthesizeMockBook(id);
    });
    return { items, limit: 20, offset: 0, has_more: false };
  }
  return {
    items: [enrichJobWithDocument(buildMockJobPayload(), MOCK_JOB_ID)],
    limit: 20,
    offset: 0,
    has_more: false,
  };
}

export function submitMockJob(): JobLike {
  // Upload流"开始Translation"也走 live 任务, 才能在Status区看到推进动画
  const live = registerLiveMockJob({
    title: "Mock UploadTranslation",
    pageCount: 12,
  });
  return buildLiveMockJobPayload(live.jobId) || buildMockJobPayload();
}

export function submitMockUpload() {
  return {
    upload_id: "mock-upload-id",
    filename: "mock.pdf",
    page_count: 12,
    bytes: 2_621_440,
  };
}




