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
    throw new Error(`Failed to load reading regions. Please retry later.(${resp.status})`);
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
    throw new Error(`Failed to load reader metadata. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderAiChat(jobId, payload, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const message = `${payload?.message || ""}`.trim();
    return {
      answer: `This is a mock reader Q&A response: ${message || "ask a question"}`,
      citations: [
        {
          title: "Mock Markdown",
          page: 1,
          snippet: "Mock mode returns fixed citations; real mode calls the backend Reader AI Chat.",
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



