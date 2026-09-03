// "Collection" tab content: folder card Grid + book list after opening a folder.
//
// LibraryGrid data pipeline left completely untouched (research plan "Design Decision 2") — folder expansion goes through
// collection_id → documents (get active_job_id) → job_ids filter library/books
// this entry bridge path (services.collections.controller.fetchFolderBooks), the returned
// data shape is exactly the same as Library first-page cards, directly reuse BookCard, no need to
// make a separate "folder detail card" rendering, and there won't be a second set of Delete confirmation popover state.

import { useCallback, useEffect, useState } from "react";
import { useHomeServices } from "../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";

// Folder card cover stack preview (reference PDF_MD_lib's FolderCard.tsx: up to 4 book
// covers stacked like a deck of cards in a fan shape, books further forward have higher z, stacked outermost). Cover images use
// BookCard's same useRecentJobCover hook (same objectURL cache, won't
// make duplicate requests just because one more render here).
const MAX_STACK = 4;

function FolderCoverStackLayer({ item, index, total }) {
  const coverUrl = useRecentJobCover(item);
  const z = 10 + (total - 1 - index);
  const rot = (index - (total - 1) / 2) * -5;
  const offsetX = (index - (total - 1) / 2) * 5;
  return (
    <div
      className="category-card-stack-item"
      style={{
        top: `${6 + index * 7}px`,
        bottom: `${10 + (total - 1 - index) * 6}px`,
        zIndex: z,
        transform: `translateX(${offsetX}px) rotate(${rot}deg)`,
      }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" />
      ) : (
        <span className="category-card-stack-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 12.5h6M9 15.5h6M9 9.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  );
}

function FolderCoverStack({ items }) {
  const stack = (Array.isArray(items) ? items : []).slice(0, MAX_STACK);
  return (
    <div className="category-card-stack">
      {stack.length === 0 ? (
        <div className="category-card-stack-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4.5l1.5 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>Empty collection</span>
        </div>
      ) : (
        stack.map((item, index) => (
          <FolderCoverStackLayer key={item.job_id} item={item} index={index} total={stack.length} />
        ))
      )}
    </div>
  );
}

export function CategoriesView() {
  const services = useHomeServices();
  const { controller, dialogStore, reloadSignal } = services.collections;
  const { actions } = services.library;
  // CollectionManageDialog is mounted at HomeApp.jsx top level, sibling to this component
  // (not parent-child), after Save/Delete can't directly prop callback — rely on a shared version number signal
  // to bridge: dialog Save success bumps once, this component subscribes to change and re-fetches list.
  const { version } = useStoreSnapshot(reloadSignal);

  const [collections, setCollections] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  // Folder card cover stack preview: collection_id → first few books in that folder (job card shape).
  const [previews, setPreviews] = useState({});

  const [openFolder, setOpenFolder] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");

  const reload = useCallback((options: { soft?: boolean } = {}) => {
    // soft: on version bump / second fetch retain old list, don't switch entire table to loading (Category tab would flicker)
    const soft = Boolean(options.soft);
    if (!soft) {
      setListLoading(true);
    }
    setListError("");
    return controller
      .listCollections()
      .then(({ collections: items = [] } = {}) => {
        setCollections(items);
        // If the folder being viewed is deleted (Delete clicked in Manage dialog), return to folder Grid.
        setOpenFolder((current) => {
          if (!current) {
            return current;
          }
          const stillExists = items.some((item) => item.collection_id === current.collection_id);
          return stillExists ? items.find((item) => item.collection_id === current.collection_id) : null;
        });
      })
      .catch((err) => setListError(err?.message || "Failed to load collection, Please retry later."))
      .finally(() => {
        if (!soft) {
          setListLoading(false);
        }
      });
  }, [controller]);

  useEffect(() => {
    // First screen hard loading; soft refresh after Manage dialog bumps version
    reload({ soft: version > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version]);

  const collectionIdsKey = collections.map((item) => item.collection_id).join(",");
  useEffect(() => {
    if (!collectionIdsKey) {
      return undefined;
    }
    let cancelled = false;
    // Each folder card's cover stack preview fetches independently, non-blocking — slow-loading folder
    // should not drag down other cards from displaying first.
    collections.forEach((collection) => {
      controller
        .fetchFolderBooks(collection.collection_id)
        .then((items) => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: items }));
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setPreviews((prev) => ({ ...prev, [collection.collection_id]: [] }));
        });
    });
    return () => {
      cancelled = true;
    };
    // collectionIdsKey only changes when "the folder set itself" changes — adding/removing books (folder set
    // unchanged) won't trigger this key change. version supplements this half: Manage dialog Save success bumps
    // once, regardless of whether this change was to name or members, preview thumbnails must refresh accordingly, otherwise
    // after editing book list the cover stack on the card stays with old data until next new/delete folder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, collectionIdsKey, version]);

  const openFolderId = openFolder?.collection_id || "";
  useEffect(() => {
    if (!openFolderId) {
      setFolderItems([]);
      setFolderError("");
      return undefined;
    }
    let cancelled = false;
    setFolderLoading(true);
    setFolderError("");
    controller
      .fetchFolderBooks(openFolderId)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setFolderItems(items);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setFolderError(err?.message || "Failed to load collection contents, Please retry later.");
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setFolderLoading(false);
      });
    // Use collection_id (primitive) not openFolder (object reference) for dependency —
    // reload() creates a new object for the same folder each time (see items.find(...) above in setOpenFolder),
    // counting object reference as dependency causes "didn't actually switch folders" to also
    // re-request once; more critically, the original version had zero cancelled guards, fast-switching
    // between two folders the later request may resolve first, the earlier request resolves later, causing Title
    // to display B folder but book list showing A folder's old data.
    return () => {
      cancelled = true;
    };
  }, [controller, openFolderId]);

  if (openFolder) {
    return (
      <section id="categories-folder-view" className="library-view categories-view" aria-label={`Collection:${openFolder.name}`}>
        <div className="categories-folder-head">
          <button
            id="categories-back-btn"
            type="button"
            className="categories-back-btn"
            onClick={() => setOpenFolder(null)}
          >
            ← Back to collection
          </button>
          <h2>{openFolder.name}</h2>
        </div>
        {folderLoading ? (
          <div className="events-empty">Loading...</div>
        ) : folderError ? (
          <div className="events-empty">{folderError}</div>
        ) : folderItems.length === 0 ? (
          <EmptyState
            instrument="balance"
            title="This collection has no books yet"
            hint="Click Manage on a collection card, then select PDFs from the library."
          />
        ) : (
          <div className="recent-jobs-list library-grid">
            {folderItems.map((item) => (
              <BookCard
                key={item.job_id}
                item={item}
                actions={buildDefaultBookCardActions(item, {
                  onReader: actions.openJobReader,
                  onReadSource: actions.openSourceReader,
                })}
                onSelect={actions.selectJob}
                onOpenDetail={actions.openBookDetail}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section id="categories-view" className="library-view categories-view" aria-label="Collection">
      <div className="categories-head">
        <button
          id="categories-create-btn"
          type="button"
          className="app-button"
          onClick={() => dialogStore.open(null)}
        >
          New collection
        </button>
      </div>
      {listLoading ? (
        <div className="events-empty">Loading collections...</div>
      ) : listError ? (
        <div className="events-empty">{listError}</div>
      ) : collections.length === 0 ? (
        <EmptyState
          id="categories-empty"
          instrument="telescope"
          title="No collections yet"
          hint="Organize PDFs by theme so they are easier to find later."
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={() => dialogStore.open(null)}
          >
            New collection
          </button>
        </EmptyState>
      ) : (
        <div id="categories-grid" className="categories-grid">
          {collections.map((collection) => (
            <div key={collection.collection_id} className="category-card">
              <button
                type="button"
                className="category-card-open"
                onClick={() => setOpenFolder(collection)}
              >
                <FolderCoverStack items={previews[collection.collection_id]} />
                <span className="category-card-name" title={collection.name}>{collection.name}</span>
                <span className="category-card-count">{collection.document_count} books</span>
              </button>
              <button
                type="button"
                className="category-card-manage"
                aria-label={`Manage collection ${collection.name}`}
                title="Manage"
                onClick={(event) => {
                  event.stopPropagation();
                  dialogStore.open(collection);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" fill="none" />
                  <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}




