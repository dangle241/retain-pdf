// Hook điều phối hỏi đáp AI: bản viết lại React của src/js/reader/ai/chat.js cũ (controller DOM 608 dòng).
// Giữ nguyên ngữ nghĩa điều phối: luồng gửi (trạng thái tiến độ → tăng dần streaming → finalize render phong phú), fallback cục bộ khi 502,
// cắt ngữ cảnh nhiều lượt (12 mục), lưu nhiều hội thoại (chat-history-store), quy tắc làm mới thanh hội thoại.
// Khung bong bóng do React render (xem ReaderAiChat.jsx), nội dung chính được ghi qua
// handle message view của answer-view theo kiểu mệnh lệnh; appendMessage dùng flushSync để bảo đảm handle khả dụng ngay.
//
// Khi ports là null (boot chưa sẵn sàng), composer ở trạng thái im lặng "Đang chuẩn bị…"; khi ports sẵn sàng,
// tự động restore (khôi phục hội thoại trước) → prepare (kết nối backend/tải Markdown).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createReaderAiHistoryStore } from "../../../../js/reader/ai/chat-history-store.js";
import { createReaderMarkdownAnswerer } from "../../../../js/reader/ai/markdown-answerer.js";
import {
  createMessageView,
  createStreamingMarkdownRenderer,
  describeToolEvent,
  hasAgenticCitations,
  renderMessageText,
  renderRichAnswer,
  setMessageProgress,
  streamMessageText,
} from "./answer-view.js";

// Chỉ fallback về tìm kiếm Markdown cục bộ khi dịch vụ AI không chạy (proxy ngược 502).
function shouldFallbackToLocal(error) {
  return error?.status === 502 || /\b502\b/.test(`${error?.message || ""}`);
}

let messageSeq = 0;

export function useReaderAiChat(ports) {
  const {
    jobId = "",
    aiContext = null,
    answerer = null,
    fallbackAnswerer = null,
    loadMarkdownPayload = null,
    remoteAnswerer = null,
    jumpToCitation = null,
    historyStore: injectedHistoryStore = null,
  } = ports || {};

  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState({ phase: "idle", text: "Đang chuẩn bị…" });
  const [sessionBar, setSessionBar] = useState({ sessions: [], activeId: "" });
  const [input, setInput] = useState("");

  const threadRef = useRef(null);
  const inputRef = useRef("");
  inputRef.current = input;
  // Ngữ cảnh nhiều lượt và snapshot có thể lưu (cùng nghĩa history/turns trong chat.js cũ).
  const historyRef = useRef([]);
  const turnsRef = useRef([]);

  const historyStore = useMemo(
    () => (ports ? (injectedHistoryStore || createReaderAiHistoryStore({ jobId })) : null),
    [ports, injectedHistoryStore, jobId],
  );
  const localAnswerer = useMemo(
    () => (ports ? (fallbackAnswerer || createReaderMarkdownAnswerer({ loadMarkdownPayload })) : null),
    [ports, fallbackAnswerer, loadMarkdownPayload],
  );
  const primaryAnswerer = answerer || remoteAnswerer || localAnswerer;

  const setComposerState = useCallback((phase, text) => {
    setComposer({ phase, text: text || "" });
  }, []);

  const scrollThread = useCallback(() => {
    const threadEl = threadRef.current;
    if (threadEl) {
      threadEl.scrollTop = threadEl.scrollHeight;
    }
  }, []);

  // Thêm một bong bóng và commit DOM đồng bộ (flushSync), trả về mục có handle view.
  const appendMessage = useCallback(({ role = "assistant", title = "" }: { role?: string; title?: string } = {}) => {
    messageSeq += 1;
    const entry = {
      id: `m-${messageSeq}`,
      role,
      title: title || (role === "user" ? "Bạn" : "Trợ lý"),
      view: createMessageView(),
    };
    flushSync(() => {
      setMessages((prev) => [...prev, entry]);
    });
    scrollThread();
    return entry;
  }, [scrollThread]);

  // Xóa trạng thái bộ nhớ và luồng (không chạm storage), dùng lại cho khôi phục/chuyển/tạo mới.
  const resetThread = useCallback(() => {
    turnsRef.current.length = 0;
    historyRef.current.length = 0;
    flushSync(() => {
      setMessages([]);
    });
  }, []);

  // Làm mới thanh chuyển hội thoại: tùy chọn thả xuống, hội thoại hiện tại, ẩn/hiện nút xóa theo số hội thoại.
  const refreshSessionBar = useCallback(() => {
    setSessionBar({
      sessions: historyStore?.listSessions?.() || [],
      activeId: historyStore?.activeSessionId?.() || "",
    });
  }, [historyStore]);

  const persist = useCallback(() => {
    historyStore?.save?.({ messages: turnsRef.current, history: historyRef.current });
    refreshSessionBar();
  }, [historyStore, refreshSessionBar]);

  // Render một snapshot đã lưu vào luồng: render lại bong bóng + điền lại ngữ cảnh nhiều lượt.
  const renderStored = useCallback(async (stored = { messages: [], history: [] }) => {
    resetThread();
    if (Array.isArray(stored.history)) {
      historyRef.current.push(...stored.history);
    }
    for (const turn of Array.isArray(stored.messages) ? stored.messages : []) {
      const role = turn?.role === "user" ? "user" : "assistant";
      const entry = appendMessage({ role, title: role === "user" ? "Bạn" : "Trợ lý" });
      const text = `${turn?.text || ""}`;
      turnsRef.current.push({ role, text, citations: turn?.citations || [] });
      if (role === "user") {
        renderMessageText(entry.view, text, []);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await renderRichAnswer(entry.view, text, turn?.citations || [], { jumpToCitation });
      }
    }
    if (turnsRef.current.length) {
      scrollThread();
    }
    return turnsRef.current.length > 0;
  }, [appendMessage, jumpToCitation, resetThread, scrollThread]);

  // Khôi phục hội thoại trước (khi mở lại trình đọc).
  const restore = useCallback(async () => {
    const restored = await renderStored(historyStore?.load?.() || { messages: [], history: [] });
    refreshSessionBar();
    return restored;
  }, [historyStore, refreshSessionBar, renderStored]);

  const prepare = useCallback(async () => {
    try {
      setComposerState("busy", remoteAnswerer ? "Đang kết nối…" : "Đang tải tài liệu…");
      await primaryAnswerer.ensureLoaded?.(jobId);
      setComposerState("ready", remoteAnswerer ? "Có thể đặt câu hỏi" : "Có thể trả lời dựa trên nội dung tài liệu");
      return true;
    } catch (error) {
      if (!remoteAnswerer) {
        setComposerState("disabled", error?.message || "Nội dung tài liệu tạm thời không khả dụng");
        return false;
      }
      try {
        await localAnswerer.ensureLoaded?.(jobId);
        setComposerState("ready", "Hỏi đáp trực tuyến tạm thời không khả dụng; đã dùng tìm kiếm cục bộ");
        return true;
      } catch (fallbackError) {
        setComposerState("disabled", fallbackError?.message || error?.message || "Hỏi đáp tạm thời không khả dụng");
        return false;
      }
    }
  }, [jobId, localAnswerer, primaryAnswerer, remoteAnswerer, setComposerState]);

  const answerWithFallback = useCallback(async (options) => {
    try {
      return {
        fallback: false,
        result: await primaryAnswerer.answer(options),
      };
    } catch (error) {
      if (!remoteAnswerer || !shouldFallbackToLocal(error)) {
        throw error;
      }
      const result = await localAnswerer.answer(options);
      return {
        fallback: true,
        reason: error?.message || "Dịch vụ AI chưa chạy",
        result,
      };
    }
  }, [localAnswerer, primaryAnswerer, remoteAnswerer]);

  const remember = useCallback((role, content) => {
    historyRef.current.push({ role, content });
    if (historyRef.current.length > 12) {
      historyRef.current.splice(0, historyRef.current.length - 12);
    }
  }, []);

  const submit = useCallback(async (question = inputRef.current) => {
    if (!primaryAnswerer) {
      return null;
    }
    const trimmed = `${question}`.trim();
    if (!trimmed) {
      return null;
    }
    const userEntry = appendMessage({ role: "user", title: "Bạn" });
    renderMessageText(userEntry.view, trimmed, []);
    turnsRef.current.push({ role: "user", text: trimmed });
    remember("user", trimmed);
    setInput("");
    inputRef.current = "";
    const assistantEntry = appendMessage({ role: "assistant", title: "Trợ lý" });
    const assistantView = assistantEntry.view;
    function showProgress(text) {
      setMessageProgress(assistantView, true);
      renderMessageText(assistantView, text, []);
      scrollThread();
    }
    let streamed = false;
    const streamRenderer = createStreamingMarkdownRenderer(assistantView);
    try {
      setComposerState("busy", remoteAnswerer ? "Đang suy nghĩ…" : "Đang tìm kiếm trong tài liệu…");
      showProgress(remoteAnswerer ? "Đang tìm kiếm trong tài liệu…" : "Đang tìm trong tài liệu…");
      const { fallback, reason, result } = await answerWithFallback({
        context: aiContext?.context?.(),
        history: historyRef.current,
        jobId,
        onToolEvent: (event) => showProgress(describeToolEvent(event)),
        // Tăng dần streaming: xóa trạng thái tiến độ ngay khi token đầu tới, render dần văn bản tích lũy dưới dạng Markdown (có throttle).
        onAnswerDelta: (fullText) => {
          streamed = true;
          setMessageProgress(assistantView, false);
          streamRenderer.push(fullText);
          scrollThread();
        },
        question: trimmed,
        scope: aiContext?.scope?.() || "document",
      });
      setMessageProgress(assistantView, false);
      streamRenderer.stop();
      const answerText = fallback
        ? `${result.answer}\n\n_Dịch vụ trực tuyến tạm thời không khả dụng; nội dung trên đến từ tìm kiếm tài liệu cục bộ._${reason ? ` (${reason})` : ""}`
        : result.answer;
      // Nếu không streaming (tìm kiếm cục bộ/backend không streaming) và không có trích dẫn thì giữ hoạt ảnh ký tự; nếu không thì finalize trực tiếp.
      if (!streamed && !hasAgenticCitations(result.citations) && !fallback) {
        await streamMessageText(assistantView, answerText, []);
      }
      // Cuối cùng: render Markdown + nút trích dẫn [n] + chú thích (thay văn bản thuần trong lúc streaming).
      await renderRichAnswer(assistantView, answerText, result.citations, { jumpToCitation });
      scrollThread();
      remember("assistant", result.answer || answerText);
      turnsRef.current.push({ role: "assistant", text: answerText, citations: result.citations || [] });
      persist();
      setComposerState("ready", fallback ? "Đã trả lời bằng tìm kiếm cục bộ" : "Có thể tiếp tục đặt câu hỏi");
      return result;
    } catch (error) {
      streamRenderer.stop();
      setMessageProgress(assistantView, false);
      renderMessageText(assistantView, error?.message || "Không thể tạo câu trả lời, vui lòng thử lại.", []);
      setComposerState("ready", "Thất bại; có thể sửa câu hỏi rồi thử lại");
      // Bong bóng trợ lý thất bại không vào turns/lưu bền vững, nhưng câu hỏi người dùng đã vào turns; lưu bổ sung để giữ câu hỏi.
      persist();
      return null;
    }
  }, [aiContext, answerWithFallback, appendMessage, jobId, jumpToCitation, persist, primaryAnswerer, remember, remoteAnswerer, scrollThread, setComposerState]);

  // Tạo hội thoại mới: lưu hội thoại hiện tại trước, sau đó mở hội thoại rỗng và render luồng rỗng.
  const newConversation = useCallback(async () => {
    persist();
    historyStore?.newSession?.();
    await renderStored({ messages: [], history: [] });
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // Chuyển tới hội thoại lịch sử chỉ định: lưu hiện tại trước, sau đó tải hội thoại đích và render lại.
  const switchConversation = useCallback(async (id) => {
    persist();
    const stored = historyStore?.switchSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // Xóa hội thoại chỉ định (mặc định là hiện tại), tự chuyển tới hội thoại gần nhất hoặc thêm một hội thoại rỗng.
  const deleteConversation = useCallback(async (id?: string) => {
    const stored = historyStore?.deleteSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, refreshSessionBar, renderStored]);

  // Sau khi ports sẵn sàng: khôi phục lịch sử trước (mở lại trình đọc thấy hội thoại trước), rồi kết nối backend.
  // Dùng setTimeout(0) để thoát khỏi giai đoạn commit React; flushSync trong restore không được gọi trong
  // lifecycle (React sẽ cảnh báo và không thể flush đồng bộ).
  const bootedRef = useRef(false);
  useEffect(() => {
    if (!ports || bootedRef.current) {
      return;
    }
    bootedRef.current = true;
    const timer = setTimeout(() => {
      // Nếu trong thời gian trì hoãn người dùng đã bắt đầu hội thoại (thực tế chỉ automation mới chạm được thời điểm này),
      // bỏ qua khôi phục vì resetThread của restore sẽ xóa bong bóng vừa tạo.
      const boot = turnsRef.current.length ? Promise.resolve(false) : restore();
      void boot.finally(() => {
        void prepare();
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [ports, prepare, restore]);

  return {
    activeSessionId: sessionBar.activeId,
    composer,
    deleteConversation,
    input,
    messages,
    newConversation,
    sessions: sessionBar.sessions,
    setInput,
    submit,
    switchConversation,
    threadRef,
  };
}
