// Homepage AI Q&A Tab Lightweight type (no reader binding) job)

/** @ Document */
export type HomeAskDocScope = {
  kind: "document";
  id: string;
  title: string;
  job_id?: string;
  source_filename?: string;
};

/** @ Collection (expands to document list on send, soft-limited search) */
export type HomeAskCollectionScope = {
  kind: "collection";
  id: string;
  title: string;
  document_count?: number;
};

export type HomeAskScope = HomeAskDocScope | HomeAskCollectionScope;

/** @deprecated Support legacy naming */
export type HomeAskDocRef = HomeAskDocScope;

export type HomeAskCitation = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export type HomeAskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: HomeAskCitation[];
  progress?: string;
  status?: "pending" | "streaming" | "complete" | "error";
};

export function scopeKey(s: HomeAskScope): string {
  return `${s.kind}:${s.id}`;
}
