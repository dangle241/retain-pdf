// AI Q&A orchestration hook: React rewrite of the legacy src/js/reader/ai/chat.js (608-line DOM controller).
// Orchestration semantics copied verbatim — submit workflow (progress state → streaming deltas → finalize rich render),
// 502 local fallback, multi-turn context truncation (12 entries), multi-conversation persistence (chat-history-store),
// session bar refresh rules.
// Bubble skeletons are rendered by React (see ReaderAiChat.jsx); the body content is written imperatively via the
// message view handle in answer-view; appendMessage uses flushSync to ensure the handle is ready immediately.
//
// When ports are null (boot not yet ready), the composer shows the "Preparing..." silent state; once ports are available,
// it auto-restores (resumes last session) → prepare (connects backend / loads Markdown).

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

// Only fall back to local Markdown search when the AI service is not running (proxy 502)
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
  const [composer, setComposer] = useState({ phase: "idle", text: "Preparing..." });
  const [sessionBar, setSessionBar] = useState({ sessions: [], activeId: "" });
  const [input, setInput] = useState("");

  const threadRef = useRef(null);
  const inputRef = useRef("");
  inputRef.current = input;
  // Multi-turn context and persistable snapshot (synonymous with history/turns in legacy chat.js)
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

  // Append a bubble entry and synchronously commit to the DOM (flushSync), returns the entry with its view handle
  const appendMessage = useCallback(({ role = "assistant", title = "" }: { role?: string; title?: string } = {}) => {
    messageSeq += 1;
    const entry = {
      id: `m-${messageSeq}`,
      role,
      title: title || (role === "user" ? "You" : "Assistant"),
      view: createMessageView(),
    };
    flushSync(() => {
      setMessages((prev) => [...prev, entry]);
    });
    scrollThread();
    return entry;
  }, [scrollThread]);

  // Clear in-memory state and thread (does not touch storage), reused by restore/switch/new
  const resetThread = useCallback(() => {
    turnsRef.current.length = 0;
    historyRef.current.length = 0;
    flushSync(() => {
      setMessages([]);
    });
  }, []);

  // Refresh New-conversation switch bar: dropdown items, current session, show/hide Delete button by session count
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

  // Render a persisted snapshot into the thread: re-render bubbles + refill multi-turn context
  const renderStored = useCallback(async (stored = { messages: [], history: [] }) => {
    resetThread();
    if (Array.isArray(stored.history)) {
      historyRef.current.push(...stored.history);
    }
    for (const turn of Array.isArray(stored.messages) ? stored.messages : []) {
      const role = turn?.role === "user" ? "user" : "assistant";
      const entry = appendMessage({ role, title: role === "user" ? "You" : "Assistant" });
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

  // Resume last session (when Reader is reopened)
  const restore = useCallback(async () => {
    const restored = await renderStored(historyStore?.load?.() || { messages: [], history: [] });
    refreshSessionBar();
    return restored;
  }, [historyStore, refreshSessionBar, renderStored]);

  const prepare = useCallback(async () => {
    try {
      setComposerState("busy", remoteAnswerer ? "Connecting..." : "Loading documents...");
      await primaryAnswerer.ensureLoaded?.(jobId);
      setComposerState("ready", remoteAnswerer ? "Ready to ask" : "Can answer based on document content");
      return true;
    } catch (error) {
      if (!remoteAnswerer) {
        setComposerState("disabled", error?.message || "Document content not ready");
        return false;
      }
      try {
        await localAnswerer.ensureLoaded?.(jobId);
        setComposerState("ready", "Online Q&A not ready. Using local search instead");
        return true;
      } catch (fallbackError) {
        setComposerState("disabled", fallbackError?.message || error?.message || "Q&A not ready");
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
        reason: error?.message || "AI service not running",
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
    const userEntry = appendMessage({ role: "user", title: "You" });
    renderMessageText(userEntry.view, trimmed, []);
    turnsRef.current.push({ role: "user", text: trimmed });
    remember("user", trimmed);
    setInput("");
    inputRef.current = "";
    const assistantEntry = appendMessage({ role: "assistant", title: "Assistant" });
    const assistantView = assistantEntry.view;
    function showProgress(text) {
      setMessageProgress(assistantView, true);
      renderMessageText(assistantView, text, []);
      scrollThread();
    }
    let streamed = false;
    const streamRenderer = createStreamingMarkdownRenderer(assistantView);
    try {
      setComposerState("busy", remoteAnswerer ? "Thinking..." : "SearchDocumentsin...");
      showProgress(remoteAnswerer ? "Searching documents..." : "正在从Documents中查找...");
      const { fallback, reason, result } = await answerWithFallback({
        context: aiContext?.context?.(),
        history: historyRef.current,
        jobId,
        onToolEvent: (event) => showProgress(describeToolEvent(event)),
        // Streaming delta: clear progress state on first token arrival, render accumulated text by Markdown step-by-step (throttled)
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
        ? `${result.answer}\n\n_在线服务暂不Ready, 以上来自books地DocumentsSearch._${reason ? `(${reason})` : ""}`
        : result.answer;
      // No streaming (local search / non-streaming backend) and no citations: keep the typewriter animation; otherwise finalize directly
      if (!streamed && !hasAgenticCitations(result.citations) && !fallback) {
        await streamMessageText(assistantView, answerText, []);
      }
      // Final: Markdown render + [n] citation buttons + footnotes (replace plain text from the streaming phase)
      await renderRichAnswer(assistantView, answerText, result.citations, { jumpToCitation });
      scrollThread();
      remember("assistant", result.answer || answerText);
      turnsRef.current.push({ role: "assistant", text: answerText, citations: result.citations || [] });
      persist();
      setComposerState("ready", fallback ? "已用books地Search回答" : "可以继续提问");
      return result;
    } catch (error) {
      streamRenderer.stop();
      setMessageProgress(assistantView, false);
      renderMessageText(assistantView, error?.message || "Failed to generate an answer. Please retry.", []);
      setComposerState("ready", "Failed, 可修改Question后Retry");
      // Failed Assistant bubble does not go into turns/persistence, but the user question already did — persist to keep the question
      persist();
      return null;
    }
  }, [aiContext, answerWithFallback, appendMessage, jobId, jumpToCitation, persist, primaryAnswerer, remember, remoteAnswerer, scrollThread, setComposerState]);

  // New conversation: save current, open an empty session, render empty thread
  const newConversation = useCallback(async () => {
    persist();
    historyStore?.newSession?.();
    await renderStored({ messages: [], history: [] });
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // Switch to the specified history session: save current, then load the target session and re-render
  const switchConversation = useCallback(async (id) => {
    persist();
    const stored = historyStore?.switchSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // Delete the specified (default current) session; auto-switch to the most recent session or fill in an empty one
  const deleteConversation = useCallback(async (id?: string) => {
    const stored = historyStore?.deleteSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, refreshSessionBar, renderStored]);

  // Once ports are ready: first restore history (reopening Reader shows the last conversation), then connect backend.
  // Bounce out of React's commit phase via setTimeout(0) — the flushSync inside restore is not allowed
  // to be called within a lifecycle (React would warn and the synchronous flush cannot proceed).
  const bootedRef = useRef(false);
  useEffect(() => {
    if (!ports || bootedRef.current) {
      return;
    }
    bootedRef.current = true;
    const timer = setTimeout(() => {
      // If the user starts a conversation during the delay (only automation can hit this timing),
      // skip restore — restore's resetThread would wipe newly produced bubbles.
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




