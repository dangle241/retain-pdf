// AI Q&A编排 hook:旧 src/js/reader/ai/chat.js(608 行 DOM 控制器)的 React 化重写.
// 编排语义原样照搬——提交Workflow(Progress态→流式增量→finalize 富Rendering), 502 books地回退, 
// 多轮上下文截断(12 entries), 多会话持久化(chat-history-store), 会话栏刷新规则.
// 气泡骨架由 React Rendering(见 ReaderAiChat.jsx),正文内容经 answer-view 的
// message view 句柄命令式写入;appendMessage 用 flushSync 确保句柄立即Ready.
//
// ports 为 null 时(boot 尚未就绪)composer 呈"Preparing..."静默态;ports 到位后
// 自动 restore(resume上次会话)→ prepare(连接后端/加载 Markdown).

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

// 仅在 AI service not running(反代 502)时回退到books地 Markdown Search
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
  // 多轮上下文与可持久化快照(与旧 chat.js 的 history/turns 同义)
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

  // 追加一entries气泡并sync提交 DOM(flushSync),返回带 view 句柄的entries目
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

  // 清空内存态与线程(不动 storage),供resume/切换/新建复用
  const resetThread = useCallback(() => {
    turnsRef.current.length = 0;
    historyRef.current.length = 0;
    flushSync(() => {
      setMessages([]);
    });
  }, []);

  // 刷New conversation切换栏:下拉选items, Current会话, 按会话数显隐Delete按钮
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

  // 把一份持久化快照Rendering进线程:重Rendering气泡 + 回填多轮上下文
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

  // resume上次会话(Reader重开时)
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
      setComposerState("busy", remoteAnswerer ? "Thinking..." : "SearchDocuments中...");
      showProgress(remoteAnswerer ? "Searching documents..." : "正在从Documents中查找...");
      const { fallback, reason, result } = await answerWithFallback({
        context: aiContext?.context?.(),
        history: historyRef.current,
        jobId,
        onToolEvent: (event) => showProgress(describeToolEvent(event)),
        // 流式增量:首个 token 到达即清Progress态,逐step把累积文books按 Markdown Rendering(节流)
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
      // 未走流式(books地Search/非流式后端)且None引用时保留字符动画;no则直接 finalize
      if (!streamed && !hasAgenticCitations(result.citations) && !fallback) {
        await streamMessageText(assistantView, answerText, []);
      }
      // 最终:Markdown Rendering + [n] 引用按钮 + 脚注(替换流式期间的纯文books)
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
      // Failed的Assistant气泡不入 turns/持久化,用户Question已入 turns——补存以保留提问
      persist();
      return null;
    }
  }, [aiContext, answerWithFallback, appendMessage, jobId, jumpToCitation, persist, primaryAnswerer, remember, remoteAnswerer, scrollThread, setComposerState]);

  // 新建对话:先存Current,再开一entries空会话并Rendering空线程
  const newConversation = useCallback(async () => {
    persist();
    historyStore?.newSession?.();
    await renderStored({ messages: [], history: [] });
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // 切换到指定History会话:先存Current,再载入目标会话重Rendering
  const switchConversation = useCallback(async (id) => {
    persist();
    const stored = historyStore?.switchSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, persist, refreshSessionBar, renderStored]);

  // Delete指定(默认Current)会话,自动切到最近的一entries或补一entries空会话
  const deleteConversation = useCallback(async (id?: string) => {
    const stored = historyStore?.deleteSession?.(id) || { messages: [], history: [] };
    await renderStored(stored);
    refreshSessionBar();
  }, [historyStore, refreshSessionBar, renderStored]);

  // ports 就绪后:先resumeHistory(重开Reader可见上次对话),再连接后端.
  // 经 setTimeout(0) 跳出 React 提交期——restore 里的 flushSync 不允许在
  // lifecycle 内调用(React 会告警且Cannotsync冲刷).
  const bootedRef = useRef(false);
  useEffect(() => {
    if (!ports || bootedRef.current) {
      return;
    }
    bootedRef.current = true;
    const timer = setTimeout(() => {
      // 若延迟期间用户已开始对话(实际只有自动化驱动能到这个时序),
      // 跳过resume——restore 的 resetThread 会清掉刚产生的气泡.
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




