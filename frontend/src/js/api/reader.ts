import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockReaderRegions } from "../mock/documents.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";

export async function fetchReaderRegions(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockReaderRegions();
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/regions`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [] };
    }
    throw new Error(`读取阅读区域失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderMetadata(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return null;
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/metadata`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
    throw new Error(`读取阅读元数据失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderAiChat(jobId, payload, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const message = `${payload?.message || ""}`.trim();
    return {
      answer: `这是 mock 阅读问答回复：${message || "请提出一个问题"}`,
      citations: [
        {
          title: "Mock Markdown",
          page: 1,
          snippet: "mock 模式下会返回固定引用，真实模式会调用后端 Reader AI Chat。",
        },
      ],
      used_context: {
        source: "mock",
        scope: payload?.scope || "document",
      },
    };
  }
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/ai/chat`, payload);
}
