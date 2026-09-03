import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  getMockTranslationItem,
  getMockTranslationItems,
  getMockTranslationReplay,
  getMockTranslationSummary,
} from "../mock/translation.js";
import { buildJobDetailEndpoint } from "./http.js";

export async function fetchTranslationDiagnostics(jobId, apiPrefix) {
  if (isMockMode()) {
    return getMockTranslationSummary(jobId);
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/diagnostics`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("Translation debug data was not found. Make sure this job completed translation.");
    }
    throw new Error(`Failed to load translation debug summary. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchTranslationItems(
  jobId,
  apiPrefix,
  {
    limit = 20,
    offset = 0,
    page = "",
    finalStatus = "",
    errorType = "",
    route = "",
    q = "",
  } = {},
) {
  if (isMockMode()) {
    return getMockTranslationItems(jobId, { limit, offset, page, finalStatus, q });
  }
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${page ?? ""}`.trim()) {
    params.set("page", `${page}`.trim());
  }
  if (`${finalStatus ?? ""}`.trim()) {
    params.set("final_status", `${finalStatus}`.trim());
  }
  if (`${errorType ?? ""}`.trim()) {
    params.set("error_type", `${errorType}`.trim());
  }
  if (`${route ?? ""}`.trim()) {
    params.set("route", `${route}`.trim());
  }
  if (`${q ?? ""}`.trim()) {
    params.set("q", `${q}`.trim());
  }
  const resp = await fetch(
    `${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items?${params.toString()}`,
    {
      headers: buildApiHeaders(),
    },
  );
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [], total: 0, limit, offset };
    }
    throw new Error(`Failed to load translation debug list. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchTranslationItem(jobId, itemId, apiPrefix) {
  if (isMockMode()) {
    return getMockTranslationItem(jobId, itemId);
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error("Translation item not found. Check whether item_id is correct.");
    }
    throw new Error(`Failed to load translation item details. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function replayTranslationItem(jobId, itemId, apiPrefix) {
  if (isMockMode()) {
    return getMockTranslationReplay(jobId, itemId);
  }
  const resp = await fetch(
    `${buildJobDetailEndpoint(jobId, apiPrefix)}/translation/items/${itemId}/replay`,
    {
      method: "POST",
      headers: buildApiHeaders(),
    },
  );
  if (!resp.ok) {
    const contentType = resp.headers.get("content-type") || "";
    if (resp.status === 404) {
      throw new Error("Translation item not found and cannot be replayed.");
    }
    if (contentType.includes("application/json")) {
      const errorPayload = await resp.json();
      throw new Error(`Failed to replay translation item: ${errorPayload.message || JSON.stringify(errorPayload)}`);
    }
    const text = await resp.text();
    throw new Error(`Failed to replay translation item: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}



