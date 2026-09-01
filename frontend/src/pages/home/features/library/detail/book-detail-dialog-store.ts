// 书籍详情弹窗的开合状态(参考 PDF_MD_lib 的 BookDetailModal)。
// payload = 被点开的那张网格卡片 item(含 document_id / job_id / status /
// library_only / reading_status / tags 等即时字段),弹窗再按 document_id 拉一次
// 完整文档补齐作者/年份/DOI/字节/日期这些卡片上没有的元数据。
//
// 复用通用 createDialogStore({ open, payload })——同 CollectionManageDialog。

import { createDialogStore } from "../../../state/dialog-store.js";
import type { LibraryCardItem } from "../types.js";

export function createBookDetailDialogStore() {
  return createDialogStore<LibraryCardItem | null>(null);
}
