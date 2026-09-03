import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint, submitJson } from "./http.js";

export async function fetchGlossaries(apiPrefix) {
  if (isMockMode()) {
    void apiPrefix;
    return {
      items: [
        {
          glossary_id: "mock-glossary-quantum",
          name: "Mock Quantum Chemistry Terms",
          entry_count: 2,
          created_at: "",
          updated_at: "",
        },
      ],
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "glossaries"), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to load glossary. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchGlossary(glossaryId, apiPrefix) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Failed to load glossary: missing glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: normalizedGlossaryId,
      name: normalizedGlossaryId === "mock-glossary-quantum" ? "Mock Quantum Chemistry Terms" : "Mock Glossary",
      entry_count: 2,
      entries: [
        {
          source: "Hartree-Fock",
          target: "",
          level: "preserve",
          match_mode: "case_insensitive",
          context: "",
          note: "Keep English",
        },
        {
          source: "density functional theory",
          target: "density functional theory",
          level: "canonical",
          match_mode: "case_insensitive",
          context: "",
          note: "Fixed translation",
        },
      ],
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Failed to load glossary details. Please retry later.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function createGlossary(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: `mock-glossary-${Date.now()}`,
      entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
      ...payload,
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "glossaries"), payload);
}

export async function updateGlossary(apiPrefix, glossaryId, payload) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Failed to save glossary: missing glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: normalizedGlossaryId,
      entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
      ...payload,
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    method: "PUT",
    headers: buildApiHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SaveGlossaryFailed: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteGlossary(apiPrefix, glossaryId) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Failed to delete glossary: missing glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return { glossary_id: normalizedGlossaryId, deleted: true };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeleteGlossaryFailed: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function exportGlossaryCsv(apiPrefix, glossaryId) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Failed to export glossary: missing glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return new Response("source,target,note,level,match_mode,context\nHartree-Fock,,Keep English,preserve,case_insensitive,\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${normalizedGlossaryId}.csv"`,
      },
    });
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}/export.csv`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to export glossary: ${resp.status} ${text || "unknown error"}`);
  }
  return resp;
}

export async function parseGlossaryCsv(apiPrefix, csvText) {
  if (isMockMode()) {
    void apiPrefix;
    void csvText;
    return {
      entry_count: 1,
      entries: [
        {
          source: "Hartree-Fock",
          target: "",
          level: "preserve",
          match_mode: "case_insensitive",
          context: "",
          note: "mock",
        },
      ],
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "glossaries/parse-csv"), {
    csv_text: `${csvText || ""}`,
  });
}



