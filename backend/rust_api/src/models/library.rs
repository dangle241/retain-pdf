use serde::{Deserialize, Serialize};

fn default_documents_limit() -> u32 {
    50
}

/// Document: a first-class citizen of the library; `document_id` is
/// `sha256(file_bytes)`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentRecord {
    pub document_id: String,
    pub title: String,
    pub authors_json: String,
    pub year: Option<i64>,
    pub doi: String,
    pub source_filename: String,
    pub page_count: u32,
    pub bytes: u64,
    pub active_job_id: Option<String>,
    pub reading_status: String,
    pub added_at: String,
    pub last_opened_at: Option<String>,
    pub updated_at: String,
    pub tags: Vec<String>,
    /// Source PDF download URL (filled by API layer for list/detail,
    /// not stored in DB).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_pdf_url: String,
    /// Cover image URL (filled by API layer for list/detail,
    /// not stored in DB).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cover_url: String,
    /// Thumbnail image URL (filled by API layer for list/detail,
    /// not stored in DB).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thumbnail_url: String,
}

/// Favorite: anchor = (document_id, job_id, page_idx, block_id[, selection]) + citation snapshot.
/// job_id marks the blockspace version containing the anchor; referenced jobs cannot be deleted alone.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FavoriteRecord {
    pub favorite_id: String,
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    pub kind: String,
    pub quote_text: String,
    pub translated_quote_text: String,
    pub note: String,
    /// Image attachment (assets.asset_id, content-addressed); empty = plain-text favorite.
    #[serde(default)]
    pub asset_id: String,
    /// Screenshot crop rectangle geometry (frontend coordinate system, stored as-is).
    #[serde(default)]
    pub rect_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Content-addressed binary asset (e.g. favorite screenshot); file body at data/assets/<2>/<hash>.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub asset_id: String,
    pub mime: String,
    pub bytes: u64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: String,
}

/// AI Q&A conversation. document_id = None means a whole-library Q&A.
/// head_id: leaf message id of currently visible branch (empty = use max(seq)).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationRecord {
    pub conversation_id: String,
    pub title: String,
    pub document_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub message_count: i64,
    /// Currently visible leaf; empty string means not explicitly set.
    #[serde(default)]
    pub head_id: String,
}

/// Conversation message. `citations_json` is a soft-anchor snapshot:
/// after job deletion, jumping to the anchor fails but content is preserved.
/// `parent_id`: tree edge; empty = root. Multiple messages with the same
/// parent are branch siblings (retries / edits).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageRecord {
    pub message_id: String,
    pub conversation_id: String,
    pub seq: i64,
    pub role: String,
    pub content: String,
    pub citations_json: String,
    pub tool_trace_json: String,
    pub model: String,
    pub created_at: String,
    /// Parent message id; empty string = root node.
    #[serde(default)]
    pub parent_id: String,
}

/// Classification folder (collection). v1 uses a flat structure for display;
/// `parent_id` is reserved for future nested sub-collections (planned at
/// table creation, currently always None, not a technical debt for this PR).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionRecord {
    pub collection_id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    /// Current number of documents in this folder; filled only by list
    /// endpoints, always 0 for single-record queries.
    #[serde(default)]
    pub document_count: i64,
}

/// A row from `blocks_fts` (derived index, can be rebuilt from job artifacts).
#[derive(Debug, Clone)]
pub struct FtsBlockRow {
    pub page_idx: i64,
    pub block_id: String,
    pub source_text: String,
    pub translated_text: String,
}

/// Full-text search hit: contains full anchors so the frontend can jump
/// to the exact position in the reader.
#[derive(Debug, Serialize, Clone)]
pub struct BlockSearchHit {
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub source_snippet: String,
    pub translated_snippet: String,
}

/// Query parameters for `GET /api/v1/documents`.
#[derive(Debug, Deserialize)]
pub struct ListDocumentsQuery {
    #[serde(default = "default_documents_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    pub reading_status: Option<String>,
    pub tag: Option<String>,
    pub collection_id: Option<String>,
    /// Look up the document owned by any `job_id` (including historical
    /// runs); allows the frontend to avoid scanning the list to reverse-lookup.
    pub job_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DocumentListView {
    pub documents: Vec<DocumentRecord>,
}

/// PATCH /api/v1/documents/:id
#[derive(Debug, Deserialize)]
pub struct PatchDocumentInput {
    pub title: Option<String>,
    pub reading_status: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// `POST /api/v1/favorites`
#[derive(Debug, Deserialize)]
pub struct CreateFavoriteInput {
    /// Optional: if `job_id` is provided, the backend automatically
    /// resolves the document (historical runs can also be favorited).
    #[serde(default)]
    pub document_id: String,
    /// The block space for the anchor; defaults to the document's
    /// current `active_job_id`.
    pub job_id: Option<String>,
    pub page_idx: i64,
    pub block_id: String,
    pub char_start: Option<i64>,
    pub char_end: Option<i64>,
    #[serde(default)]
    pub kind: Option<String>,
    pub quote_text: String,
    #[serde(default)]
    pub translated_quote_text: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    /// Image attachment: first `POST /api/v1/assets` to get an
    /// `asset_id` then attach it (suggested `kind` = "figure").
    #[serde(default)]
    pub asset_id: Option<String>,
    /// Screenshot crop rectangle geometry (stored as-is from the
    /// frontend coordinate system).
    #[serde(default)]
    pub rect_json: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListFavoritesQuery {
    pub document_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteListView {
    pub favorites: Vec<FavoriteRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchFavoriteInput {
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FavoriteMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

fn default_search_limit() -> u32 {
    20
}

/// `GET /api/v1/search`
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_search_limit")]
    pub limit: u32,
    /// Restrict to a single document (Reader / AI whole-book Q&A);
    /// empty = whole library.
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct SearchResultView {
    pub query: String,
    pub hits: Vec<BlockSearchHit>,
}

// --- conversations ---

#[derive(Debug, Deserialize)]
pub struct CreateConversationInput {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub document_id: String,
}

fn default_conversations_limit() -> u32 {
    50
}

#[derive(Debug, Deserialize)]
pub struct ListConversationsQuery {
    #[serde(default = "default_conversations_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    /// Filter by document; empty = all.
    #[serde(default)]
    pub document_id: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationListView {
    pub conversations: Vec<ConversationRecord>,
}

#[derive(Debug, Serialize)]
pub struct ConversationDetailView {
    #[serde(flatten)]
    pub conversation: ConversationRecord,
    pub messages: Vec<MessageRecord>,
}

#[derive(Debug, Deserialize)]
pub struct AppendMessageInput {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub citations_json: String,
    #[serde(default)]
    pub tool_trace_json: String,
    #[serde(default)]
    pub model: String,
    /// Parent message id; omitted/empty = attach to current head (linear continuation).
    #[serde(default)]
    pub parent_id: String,
    /// Client-side stable id (aligned with assistant-ui store id); if empty, the server generates one.
    #[serde(default)]
    pub message_id: String,
    /// Whether to point the head to this message after appending; defaults to true.
    #[serde(default = "default_true")]
    pub set_head: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct PatchConversationInput {
    /// Switch the visible branch leaf node.
    #[serde(default)]
    pub head_id: String,
    #[serde(default)]
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationMutationResult {
    pub deleted: bool,
}

// --- collections ---

#[derive(Debug, Deserialize)]
pub struct CreateCollectionInput {
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionListView {
    pub collections: Vec<CollectionRecord>,
}

#[derive(Debug, Deserialize)]
pub struct PatchCollectionInput {
    pub name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct AddCollectionDocumentsInput {
    pub document_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CollectionMutationResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed: Option<bool>,
}
