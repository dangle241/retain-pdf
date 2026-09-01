use anyhow::Result;
use rusqlite::Connection;

/// Library data layer ID migration ladder(PRAGMA user_version)。
///
/// Existing ensure_schema idempotent DDL and ensure_*_column incremental column addition continues to handle
/// Task system tables;New platform table(documents/favorites/...)Version from here.
/// migration,Future breaking changes append new version only,Historical entries immutable.
const VERSIONED_MIGRATIONS: &[&str] = &[
// v1: library foundation ââ Docs first-class + Anchor bookmark + Collection/Label + FTS5
    r#"
    CREATE TABLE IF NOT EXISTS documents (
        document_id     TEXT PRIMARY KEY,
        title           TEXT NOT NULL DEFAULT '',
        authors_json    TEXT NOT NULL DEFAULT '[]',
        year            INTEGER,
        doi             TEXT NOT NULL DEFAULT '',
        source_filename TEXT NOT NULL,
        page_count      INTEGER NOT NULL DEFAULT 0,
        bytes           INTEGER NOT NULL DEFAULT 0,
        active_job_id   TEXT,
        reading_status  TEXT NOT NULL DEFAULT 'unread',
        added_at        TEXT NOT NULL,
        last_opened_at  TEXT,
        updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_added_at ON documents(added_at DESC);
    CREATE TABLE IF NOT EXISTS favorites (
        favorite_id     TEXT PRIMARY KEY,
        document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
        job_id          TEXT NOT NULL,
        page_idx        INTEGER NOT NULL,
        block_id        TEXT NOT NULL,
        char_start      INTEGER,
        char_end        INTEGER,
        kind            TEXT NOT NULL DEFAULT 'sentence',
        quote_text      TEXT NOT NULL,
        translated_quote_text TEXT NOT NULL DEFAULT '',
        note            TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_document ON favorites(document_id, page_idx);
    CREATE TABLE IF NOT EXISTS collections (
        collection_id   TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        parent_id       TEXT REFERENCES collections(collection_id) ON DELETE SET NULL,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_documents (
        collection_id   TEXT NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
        document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
        added_at        TEXT NOT NULL,
        PRIMARY KEY(collection_id, document_id)
    );
    CREATE TABLE IF NOT EXISTS document_tags (
        document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
        tag             TEXT NOT NULL,
        PRIMARY KEY(document_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
    CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
        document_id UNINDEXED, job_id UNINDEXED, page_idx UNINDEXED, block_id UNINDEXED,
        source_text, translated_text,
        tokenize='trigram'
    );
    "#,
// v2: Asset storage (content-addressed, save image attachments) + AI Session./Message.
    // Design principles:User curation(Favorite)Hard anchor,Machine-generated(Quote reference)Soft anchor.
// ââStore references only. citations_json snapshot, skip job delete protection.
    r#"
    CREATE TABLE IF NOT EXISTS assets (
        asset_id    TEXT PRIMARY KEY,          -- sha256(File bytes)
        mime        TEXT NOT NULL,
        bytes       INTEGER NOT NULL,
        width       INTEGER,
        height      INTEGER,
        created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
        conversation_id TEXT PRIMARY KEY,
        title           TEXT NOT NULL DEFAULT '',
        document_id     TEXT REFERENCES documents(document_id) ON DELETE SET NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);
    CREATE TABLE IF NOT EXISTS ai_messages (
        message_id      TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
        seq             INTEGER NOT NULL,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        citations_json  TEXT NOT NULL DEFAULT '[]',
        tool_trace_json TEXT NOT NULL DEFAULT '[]',
        model           TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL,
        UNIQUE(conversation_id, seq)
    );
    ALTER TABLE favorites ADD COLUMN asset_id  TEXT NOT NULL DEFAULT '';
    ALTER TABLE favorites ADD COLUMN rect_json TEXT NOT NULL DEFAULT '';
    "#,
    // v3: AI Message tree branch —— parent_id Create sibling branch.; head_id Record current visible leaf.
// Consistent with ChatGPT / assistant-ui: same parent multiple messages i.e. alternate.
// Compatible:Old line parent_id Empty, chain linearly by seq.; load Timeless head or max(seq).
    r#"
    ALTER TABLE ai_conversations ADD COLUMN head_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE ai_messages ADD COLUMN parent_id TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_ai_messages_parent
        ON ai_messages(conversation_id, parent_id);
    "#,
];

pub(super) fn run_versioned_migrations(conn: &Connection) -> Result<()> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, migration) in VERSIONED_MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= current {
            continue;
        }
        conn.execute_batch(&format!(
            "BEGIN;\n{migration}\nPRAGMA user_version = {version};\nCOMMIT;"
        ))?;
    }
    Ok(())
}

pub(super) fn ensure_uploads_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "uploads", column, column_def)
}

pub(super) fn ensure_jobs_column(conn: &Connection, column: &str, column_def: &str) -> Result<()> {
    ensure_table_column(conn, "jobs", column, column_def)
}

pub(super) fn ensure_events_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "events", column, column_def)
}

pub(super) fn ensure_glossaries_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "glossaries", column, column_def)
}

fn ensure_table_column(
    conn: &Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_column = false;
    for row in rows {
        if row? == column {
            has_column = true;
            break;
        }
    }
    if !has_column {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {column_def}"),
            [],
        )?;
    }
    Ok(())
}

pub(super) fn ensure_no_legacy_artifacts_json(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(jobs)")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_legacy_column = false;
    for row in rows {
        if row? == "artifacts_json" {
            has_legacy_column = true;
            break;
        }
    }
    if !has_legacy_column {
        return Ok(());
    }
    let legacy_count: i64 = conn.query_row(
        r#"
        SELECT COUNT(*)
        FROM jobs
        WHERE artifacts_json IS NOT NULL AND TRIM(artifacts_json) <> ''
        "#,
        [],
        |row| row.get(0),
    )?;
    if legacy_count > 0 {
        anyhow::bail!(
            "legacy jobs.artifacts_json storage is no longer supported; found {legacy_count} legacy rows, clear the DB or rerun those jobs"
        );
    }
    Ok(())
}
