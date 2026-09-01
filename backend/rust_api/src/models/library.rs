use serde::{Deserialize, Serialize};

fn default_documents_limit() -> u32 {
    50
}

/// Document: Library first-class citizen, document_id = sha256(file bytes).
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
/// Source PDF download URL; list/details padded by API layer, not written to DB
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_pdf_url: String,
/// Cover image URL (list/details padded by API layer, not stored)
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cover_url: String,
/// Thumbnail URL (list/details padded by API layer, not stored)
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub thumbnail_url: String,
}

/// Favorite: Anchor = (document_id, job_id, page_idx, block_id[, Selection]) + Citation snapshot.
/// job_id Mark block space version containing anchor.;referenced job Individual deletion disallowed.
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
/// Image attachment (assets.asset_id, content-addressable); Empty string = text-only favorite
    #[serde(default)]
    pub asset_id: String,
    /// Screenshot crop rectangle geometry(Frontend coordinate system,Lump-sum deposit and withdrawal)
    #[serde(default)]
    pub rect_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Content-addressed binary assets(Bookmark screenshots etc.);File body at data/assets/<2>/<hash>。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetRecord {
    pub asset_id: String,
    pub mime: String,
    pub bytes: u64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: String,
}

/// AI Q&A session. document_id empty = full-database Q&A.
/// head_id: Leaf message id of currently visible branch (empty = infer from max(seq)).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationRecord {
    pub conversation_id: String,
    pub title: String,
    pub document_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub message_count: i64,
    /// Visible leaves;Empty string means not explicitly set.
    #[serde(default)]
    pub head_id: String,
}

/// Session message.citations_json Soft anchor snapshot.:job Redirect fails post-delete; data persists.
/// parent_id: Tree edge; empty = Root. Multiple entries under same parent are sibling branches (retry/edit).
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
    /// Parent message id;Empty string = Root node.
    #[serde(default)]
    pub parent_id: String,
}

/// Categorization folders (collections). v1 displays flat structure only; parent_id reserved for future nested subcategories.
/// (Plan schema at creation.,Always current None,Not tech debt for this refactor.)。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionRecord {
    pub collection_id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    /// Current document count in this folder;Only list API populates this.,Single query always returns 0。
    #[serde(default)]
    pub document_count: i64,
}

/// blocks_fts one line (derived index, rebuildable from task artifacts anytime).
#[derive(Debug, Clone)]
pub struct FtsBlockRow {
    pub page_idx: i64,
    pub block_id: String,
    pub source_text: String,
    pub translated_text: String,
}

/// Full-text search hit:With full anchor,Frontend navigates to reader in-place.
#[derive(Debug, Serialize, Clone)]
pub struct BlockSearchHit {
    pub document_id: String,
    pub job_id: String,
    pub page_idx: i64,
    pub block_id: String,
    pub source_snippet: String,
    pub translated_snippet: String,
}

/// GET /api/v1/documents Query parameters.
#[derive(Debug, Deserialize)]
pub struct ListDocumentsQuery {
    #[serde(default = "default_documents_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    pub reading_status: Option<String>,
    pub tag: Option<String>,
    pub collection_id: Option<String>,
/// Given job_id (including historical runs) query parent doc directly; frontend no longer scans list for reverse lookup.
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

/// POST /api/v1/favorites
#[derive(Debug, Deserialize)]
pub struct CreateFavoriteInput {
/// Optional: Given job_id, backend auto-parses parent document. (Historical runs can also be favorited.)
    #[serde(default)]
    pub document_id: String,
    /// Block space for anchor;Default to current doc. active_job_id
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
/// Image attachment: first POST /api/v1/assets to get asset_id then reattach. (kind suggestion figure)
    #[serde(default)]
    pub asset_id: Option<String>,
/// Screenshot crop rectangle geometry (store frontend coordinates as-is).
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

/// GET /api/v1/search
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_search_limit")]
    pub limit: u32,
    /// Limit to single document (reader / AI Entire Q&A); empty = Full DB
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
/// Filter by doc; empty = All.
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
/// Parent message id; omit/empty = mount to current head (linear continuation).
    #[serde(default)]
    pub parent_id: String,
/// Client stable id (align with assistant-ui store id); server generates if empty.
    #[serde(default)]
    pub message_id: String,
/// Add after? head points to this item; default true.
    #[serde(default = "default_true")]
    pub set_head: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct PatchConversationInput {
    /// Toggle visible branch leaf nodes.
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
