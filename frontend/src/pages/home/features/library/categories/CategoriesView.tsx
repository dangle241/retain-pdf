// "Collection"tab 的内容:Files夹卡片Grid + 点开一个Files夹后的书目List.
//
// LibraryGrid的Data链路完全不动(调研计划"设计决策 2")——Files夹展开时走
// collection_id → documents(拿 active_job_id)→ job_ids 过滤 library/books
// 这entries桥接路径(services.collections.controller.fetchFolderBooks),换回来的
// Data形状和Library首pages卡片完全一致,直接复用 BookCard,不用
// 另外做一套"Files夹详情卡片"Rendering,也不会有第二套Delete确认气泡Status.

import { useCallback, useEffect, useState } from "react";
import { useHomeServices } from "../../../home-services-context.js";
import { useStoreSnapshot } from "../../../../../shared/react/use-store.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";
import { BookCard, buildDefaultBookCardActions } from "../shell/BookCard.jsx";
import { useRecentJobCover } from "../display/useRecentJobCover.js";

// Files夹卡片的封面堆叠预览(参考 PDF_MD_lib 的 FolderCard.tsx:最多 4 books书的
// 封面像扑克牌一样扇形叠放,越靠前的书 z 越高, 叠在最外面).封面图沿用
// BookCard 同一个 useRecentJobCover hook(同一份 objectURL 缓存,不会
// 因为这里多Rendering一份而重复请求).
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
  // CollectionManageDialog 挂在 HomeApp.jsx 顶层,和这个组件yes兄弟节点
  // (不yes父子),Save/Delete后没法直接 prop 回调回来——靠一个total享的版books号信号
  // 桥接:对话框Save成功就 bump 一次,这里订阅到变化就重新拉取List.
  const { version } = useStoreSnapshot(reloadSignal);

  const [collections, setCollections] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  // Files夹卡片的封面堆叠预览:collection_id → 该Files夹前几books书(job 卡片形状).
  const [previews, setPreviews] = useState({});

  const [openFolder, setOpenFolder] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");

  const reload = useCallback((options: { soft?: boolean } = {}) => {
    // soft: version bump / 二次拉取时保留旧List, 不整表切成 loading(Category tab 闪一下)
    const soft = Boolean(options.soft);
    if (!soft) {
      setListLoading(true);
    }
    setListError("");
    return controller
      .listCollections()
      .then(({ collections: items = [] } = {}) => {
        setCollections(items);
        // 正在View的Files夹如果被删了(Manage弹窗里点了Delete),退回Files夹Grid.
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
    // 首屏 hard loading；Manage弹窗 bump version 后 soft 刷新
    reload({ soft: version > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, version]);

  const collectionIdsKey = collections.map((item) => item.collection_id).join(",");
  useEffect(() => {
    if (!collectionIdsKey) {
      return undefined;
    }
    let cancelled = false;
    // 每个Files夹卡片的封面堆叠预览各自独立拉取,互不阻塞——某个Files夹加载慢
    // 不该拖住其余卡片先Display出来.
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
    // collectionIdsKey 只在"Files夹集合books身"变化时变——只加/删书(Files夹集合
    // 不变)不会触发这个 key 变化.version 补上这一半:Manage弹窗Save成功就
    // bump 一次,不管这次改的yes名称还yes成员,预览缩略图都要跟着刷新,no则
    // Edit完书目后卡片上的封面堆叠会停在旧Data,直到下次新建/DeleteFiles夹.
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
    // 用 collection_id(原始Type)而不yes openFolder(对象引用)做依赖——
    // reload() 每次都会给同一个Files夹造一个新对象(见上面 setOpenFolder 里
    // 的 items.find(...)),按对象引用算依赖会导致"没真的切换Files夹"也
    // 重新请求一次;更关键的yes原来那版完全没有 cancelled 守卫,快速切换
    // 两个Files夹时后发的请求可能先resolve, 先发的请求后resolve,导致Title
    // Display B Files夹, 书目List却yes A Files夹的旧Data.
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




