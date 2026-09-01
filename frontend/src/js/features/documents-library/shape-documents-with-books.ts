// "一batchesDocuments → 一batchesGrid卡片 item"的唯一编排(重构②).
//
// 之前这套"收集有 active_job_id 的Documents → Batch取 library/books 活态 → 建
// bookMap → 逐documents shapeDocumentCardItem"的编排被抄了两份:Library主Grid
// (document-library-source.js)和Collection展开(collections/controller.js).两份
// 发散yes"Empty collection" bug 的根源——Collection那份yes F2 Documents中心化之前的旧拷贝,自己
// filter 掉了LibraryDocuments.收成这一个函数后,任何"列一batchesDocuments成卡片"的界面
// (Library/Collection/搜索/未来的新入口)都穿过它,不会再各自发散.
//
// 只负责 documents → cards 的映射(保序,不去重/不mpages/不搜索过滤——那些yes
// 各消费方自己的关切,留在调用方).

import { shapeDocumentCardItem } from "./document-card-item.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

// documents: /documents 返回的Documents数组
// fetchLibraryBookList: (apiPrefix, { jobIds, limit }: any) => { items } 端口(可缺省)
// 返回:与 documents 等长, 同序的卡片 item 数组(Translated叠加 book 活态,Library走
// 合成 job_id).
export async function shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix }: any = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  const jobIds = docs.map((doc) => normalizedJobId(doc?.active_job_id)).filter(Boolean);

  const bookMap = new Map();
  if (jobIds.length && typeof fetchLibraryBookList === "function") {
    const payload = await fetchLibraryBookList(apiPrefix, { jobIds, limit: jobIds.length });
    for (const book of (Array.isArray(payload?.items) ? payload.items : [])) {
      const id = normalizedJobId(book?.job_id);
      if (id) {
        bookMap.set(id, book);
      }
    }
  }

  return docs.map((doc) => {
    const activeJobId = normalizedJobId(doc?.active_job_id);
    return shapeDocumentCardItem(doc, activeJobId ? bookMap.get(activeJobId) || null : null);
  });
}




