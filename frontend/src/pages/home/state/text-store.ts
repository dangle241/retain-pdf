// Store registry nội dung trang home (ID → nội dung).
//
// Trong hệ thống cũ, setText(id, value) của ui/text.js là điểm ghi DOM toàn cục; trong React, chuyển thành
// ghi store này để component đăng ký ID tương ứng tự render. Ở giai đoạn 3a chỉ error-box
// (inline-error-box) sử dụng; ID của miền 3b như status-detail/job-runtime trước tiên được ghi vào
// store chờ component placeholder tiếp quản; vì vậy giao diện callback setText giữ ổn định cho 3b.
//
// Quy ước trường hợp đặc biệt (phản chiếu ui/text.js): value của "error-box" có thể là đối tượng error-diagnostic;
// tầng hiển thị dùng messageForErrorBox trích xuất tóm tắt; tại đây lưu nguyên trạng để component diễn giải.

import { createStore, type Store } from "../../../js/app-framework/store.js";

/** Hình dạng trả về của error-diagnostics.buildErrorDiagnostic. */
export type ErrorDiagnosticText = {
  kind: "error-diagnostic";
  summary?: string;
  diagnostic?: string;
  [key: string]: unknown;
};

/**
 * Giá trị ô nội dung: chuỗi thường, đối tượng chẩn đoán error-box hoặc payload hiển thị khác.
 * Dùng unknown để giới hạn, tránh any; ErrorDiagnosticText để tầng hiển thị thu hẹp kiểu.
 */
export type HomeTextValue = unknown;

export type HomeTextState = {
  texts: Record<string, HomeTextValue>;
};

export type HomeTextActions = {
  set(
    currentState: HomeTextState,
    payload?: { id?: string; value?: HomeTextValue },
  ): HomeTextState;
};

export type HomeTextStore = Store<HomeTextState, HomeTextActions>;

export function createHomeTextStore() {
  const store = createStore<HomeTextState, HomeTextActions>({
    name: "homeTextRegistry",
    initialState: { texts: {} },
    actions: {
      set(currentState, { id, value } = {}) {
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          texts: {
            ...currentState.texts,
            [id]: value,
          },
        };
      },
    },
  });

  function setText(id: string, value: HomeTextValue = undefined) {
    if (!id) {
      return;
    }
    store.actions.set({ id, value });
  }

  // Hàm trợ giúp selector: dùng cùng useStoreSnapshot(store, selector).
  function textOf(
    snapshot: HomeTextState | null | undefined,
    id: string,
    fallback: HomeTextValue = "",
  ): HomeTextValue {
    const value = snapshot?.texts?.[id];
    return value === undefined ? fallback : value;
  }

  return {
    setText,
    store,
    textOf,
  };
}
