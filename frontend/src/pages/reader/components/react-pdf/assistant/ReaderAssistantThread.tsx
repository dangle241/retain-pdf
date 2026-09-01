// assistant-ui Reader问答: Progress与正文m离；Done后一次性 Markdown+公式+引用.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
  useMessagePartText,
  useThreadRuntime,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GitBranch,
  ListTree,
  Loader2,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  armReaderAiClickShield,
  hydrateProtectedImages,
  revokeHydratedImageUrls,
  injectCitationMarkers,
  isAgenticCitation,
  lockReaderAiNavigation,
  neutralizeMarkdownAnchors,
  peekFinalAnswerHtmlCache,
  renderCitationFooter,
  renderFinalAnswerHtml,
  renderStreamingPreviewHtml,
  shouldIgnoreReaderAiNavEvent,
  type AiCitationLike,
} from "../../../external.js";
import {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
  MISSING_MODEL_API_KEY_MESSAGE,
} from "../../../../../js/reader/ai/config.js";

/** Notion 侧栏式Suggestion: 图标 + 短Title */
const SUGGESTIONS: Array<{
  prompt: string;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    prompt: "Summarize the core content of this paper in a few sentences.",
    label: "Summarize this page",
    icon: BookOpen,
  },
  {
    prompt: "What are the main conclusions of this paper?",
    label: "Extract main conclusions",
    icon: ListTree,
  },
  {
    prompt: "What methods or models did the authors use?",
    label: "Outline methods and models",
    icon: FlaskConical,
  },
  {
    prompt: "What are the key results or data?",
    label: "Highlight key results",
    icon: Sparkles,
  },
];

export type ReaderAssistantThreadProps = {
  jobId?: string;
  citationsByMessageId?: Record<string, AiCitationLike[]>;
  progressByMessageId?: Record<string, string>;
  /** store 正文旁路, 保证流式 token 能立刻Rendering */
  contentByMessageId?: Record<string, string>;
  /** Current正在生成的 assistant id(旁路 status, 避免 aui 不刷 running) */
  streamingAssistantId?: string;
  isRunning?: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  /** 从助手Answer开新会话窗口(Copy到该点的History) */
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  branchBusy?: boolean;
};

type AskUiContextValue = {
  jobId: string;
  citationsByMessageId: Record<string, AiCitationLike[]>;
  progressByMessageId: Record<string, string>;
  contentByMessageId: Record<string, string>;
  streamingAssistantId: string;
  isRunning: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
  branchBusy?: boolean;
};

const AskUiContext = createContext<AskUiContextValue>({
  jobId: "",
  citationsByMessageId: {},
  progressByMessageId: {},
  contentByMessageId: {},
  streamingAssistantId: "",
  isRunning: false,
});

function messageIsStreaming(
  message: unknown,
  streamingAssistantId = "",
  isRunning = false,
): boolean {
  const status = (message as { status?: { type?: string } } | null)?.status;
  if (status?.type === "running") return true;
  if (status?.type === "complete" || status?.type === "incomplete") return false;
  // aui 有时不把 ExternalStore 的 status 映到 useMessage；用旁路 id 兜底
  if (!isRunning || !streamingAssistantId) return false;
  const id = `${(message as { id?: string } | null)?.id || ""}`;
  const storeId = `${(message as { metadata?: { custom?: { storeId?: string } } } | null)
    ?.metadata?.custom?.storeId || ""}`;
  return id === streamingAssistantId || storeId === streamingAssistantId;
}

function useViewportStickBottom(
  viewportRef: RefObject<HTMLElement | null>,
  suppressAutoScroll = false,
) {
  const suppressRef = useRef(suppressAutoScroll);
  suppressRef.current = suppressAutoScroll;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const stick = { current: true };
    let raf = 0;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stick.current = distance < 120;
    };
    const scrollBottom = () => {
      // branch/切会话 remount 时禁止强行滚底, no则体感像"刷新并跳转"
      if (suppressRef.current) return;
      if (el.dataset.suppressAutoscroll === "1") return;
      if (!stick.current) return;
      el.scrollTop = el.scrollHeight;
    };
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scrollBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const mo = new MutationObserver((records) => {
      const structural = records.some(
        (r) => r.type === "childList" && (r.addedNodes.length > 0 || r.removedNodes.length > 0),
      );
      if (structural) schedule();
    });
    mo.observe(el, { childList: true, subtree: true });
    // 仅首挂且未 suppress 时贴底
    if (!suppressAutoScroll) schedule();
    return () => {
      el.removeEventListener("scroll", onScroll);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [viewportRef, suppressAutoScroll]);
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="aui-thinking" role="status" aria-live="polite">
      <Loader2 className="aui-spin" size={14} strokeWidth={2.4} aria-hidden />
      <span>{label || "Thinking..."}</span>
    </div>
  );
}

function readMessageCustom(message: unknown): {
  citations: AiCitationLike[];
  progress: string;
  storeId: string;
  messageId: string;
} {
  const m = message as {
    id?: string;
    metadata?: { custom?: Record<string, unknown> };
  } | null;
  const custom = m?.metadata?.custom || {};
  const citations = Array.isArray(custom.citations)
    ? (custom.citations as AiCitationLike[])
    : [];
  return {
    citations,
    progress: `${custom.progress || ""}`,
    storeId: `${custom.storeId || ""}`,
    messageId: `${m?.id || ""}`,
  };
}

function MarkdownText() {
  const { text } = useMessagePartText();
  const message = useMessage();
  const {
    citationsByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    onJumpCitation,
  } = useContext(AskUiContext);
  const meta = readMessageCustom(message);
  const streaming = messageIsStreaming(message, streamingAssistantId, isRunning);
  // 优先 metadata.custom(稳定)；回退 store map
  const citations = meta.citations.length
    ? meta.citations
    : (citationsByMessageId[meta.storeId] || citationsByMessageId[meta.messageId] || []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // 流式: 优先 contentByMessageId(store/旁路直通), 避免 aui Parts 缓存导致"答完才Rendering"
  const storeText =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  // 流式过程不要 trim 尾部, 避免半句被吃掉；Done后再 trim
  const bodyText = streaming
    ? `${storeText || text || ""}`
    : `${storeText || text || ""}`.trim();
  // branch remount 时 id 变了但正文相同: 用缓存避免闪 pending
  const [finalHtml, setFinalHtml] = useState<string | null>(() =>
    (streaming || !bodyText ? null : peekFinalAnswerHtmlCache(bodyText)),
  );
  const lastFinalKeyRef = useRef("");

  const citationByRef = useMemo(() => {
    const map = new Map<string, AiCitationLike>();
    for (const citation of citations) {
      if (isAgenticCitation(citation)) {
        map.set(`${citation.ref}`, citation);
      }
    }
    return map;
  }, [citations]);

  const citeKey = useMemo(
    () => citations.map((c) => `${c.ref}:${c.block_id}:${c.page_idx}`).join("|"),
    [citations],
  );

  // 流式: sync轻量 HTML, 绝不走 MathJax 异step(no则会"写完才Display")
  const streamingHtml = useMemo(
    () => (streaming && bodyText ? renderStreamingPreviewHtml(bodyText) : ""),
    [streaming, bodyText],
  );

  useEffect(() => {
    if (streaming) {
      setFinalHtml(null);
      lastFinalKeyRef.current = "";
      return;
    }
    if (!bodyText) {
      setFinalHtml("");
      return;
    }
    const key = `${bodyText}\n@@${citeKey}`;
    if (lastFinalKeyRef.current === key) return;
    const cached = peekFinalAnswerHtmlCache(bodyText);
    if (cached != null) {
      lastFinalKeyRef.current = key;
      setFinalHtml(cached);
      return;
    }
    let cancelled = false;
    lastFinalKeyRef.current = key;
    void (async () => {
      try {
        const html = await renderFinalAnswerHtml(bodyText);
        if (!cancelled) setFinalHtml(html);
      } catch {
        if (!cancelled) setFinalHtml(renderStreamingPreviewHtml(bodyText));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streaming, bodyText, citeKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || streaming || finalHtml == null || !finalHtml) return;

    // 覆盖前回收上一轮 hydrate 的 blob URL(重Rendering反复生成新 blob, 
    // 旧的会泄漏到PagesClose——审计 P1-5)
    revokeHydratedImageUrls(root);
    root.innerHTML = finalHtml;
    neutralizeMarkdownAnchors(root, {
      onOpen: () => true,
    });
    injectCitationMarkers(root, citationByRef, onJumpCitation || null);
    if (root.querySelectorAll("img[src]").length) {
      void hydrateProtectedImages(root);
    }
    const bubble = root.closest(".aui-msg-bubble");
    if (bubble instanceof HTMLElement) {
      renderCitationFooter(bubble, citations, {
        onJump: (citation) => {
          if (shouldIgnoreReaderAiNavEvent(null)) return;
          onJumpCitation?.(citation);
        },
        answerText: bodyText,
        max: 5,
      });
    }
  }, [streaming, finalHtml, citationByRef, citations, onJumpCitation, bodyText]);

  // 卸载(切消息/关浮窗)回收books气泡的 blob
  useEffect(() => () => {
    revokeHydratedImageUrls(rootRef.current);
  }, []);

  if (streaming) {
    if (!bodyText.trim()) return null;
    return (
      <div
        className="aui-md aui-md-streaming"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: streamingHtml }}
      />
    );
  }

  if (!bodyText) return null;

  if (finalHtml == null) {
    return (
      <div
        className="aui-md aui-md-pending"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderStreamingPreviewHtml(bodyText) }}
      />
    );
  }

  if (!finalHtml) return null;
  return <div ref={rootRef} className="aui-md aui-md-final" />;
}

const StableMarkdownText: TextMessagePartComponent = MarkdownText;

function messagePlainText(message: unknown): string {
  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        return `${(part as { text?: string }).text || ""}`;
      }
      return "";
    })
    .join("")
    .trim();
}

/**
 * 兄弟节点切换器.
 * - path: 同一Answer下的多entries续问路径
 * - answer: 同一Question下的多版RetryAnswer
 */
function MessageBranchPicker({ kind }: { kind: "path" | "answer" }) {
  const label = kind === "path" ? "branch" : "Answer";
  return (
    <BranchPickerPrimitive.Root
      className={`aui-branch-picker aui-branch-picker-${kind}`}
      hideWhenSingleBranch
      title={kind === "path" ? "切换从此Answerm出的路径" : "切换不同Answer版books"}
    >
      <span className="aui-branch-kind" aria-hidden>
        {label}
      </span>
      <BranchPickerPrimitive.Previous asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "上一个branch" : "上一个Answer"}
        >
          <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-count" aria-live="polite">
        <BranchPickerPrimitive.Number />
        <span className="aui-branch-sep">/</span>
        <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "下一个branch" : "下一个Answer"}
        >
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

/**
 * 从助手Answer开"新会话窗口": 
 * Copy root→booksAnswer 的History到新 conversation, 原会话不动(类似 ChatGPT Branch in new chat).
 */
function AssistantMessage() {
  const message = useMessage();
  const {
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    onBranchFromAnswer,
    branchBusy,
  } = useContext(AskUiContext);
  const streaming = messageIsStreaming(message, streamingAssistantId, isRunning);
  const meta = readMessageCustom(message);
  const progress = meta.progress
    || progressByMessageId[meta.storeId]
    || progressByMessageId[meta.messageId]
    || "";
  const storeBody =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  const hasBody = storeBody.trim().length > 0 || messagePlainText(message).length > 0;
  const assistantId = meta.storeId || meta.messageId || message.id;
  const [forking, setForking] = useState(false);

  const handleBranch = async (event: ReactMouseEvent | ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onBranchFromAnswer || !assistantId || branchBusy || forking) return;
    setForking(true);
    try {
      // 等 click 完全结束后再上全屏遮罩, 绝不能在 pointerdown 就盖住按钮
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });
      armReaderAiClickShield(1200, { overlayDelayMs: 0 });
      lockReaderAiNavigation(1200);
      const ok = await onBranchFromAnswer(assistantId);
      if (!ok) {
        // Failed时也给一点反馈Time(sessionError 在会话entries)
        armReaderAiClickShield(200, { overlayDelayMs: 0 });
      }
    } finally {
      setForking(false);
    }
  };

  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-assistant">
      <div className="aui-msg-avatar" aria-hidden>
        <Sparkles size={14} strokeWidth={2.1} />
      </div>
      <div className="aui-msg-stack">
      {streaming && progress ? <ThinkingRow label={progress} /> : null}
      {streaming && !progress && !hasBody ? <ThinkingRow label="Thinking..." /> : null}
      {hasBody ? (
        <div className="aui-msg-bubble">
          <MessagePrimitive.Parts components={{ Text: StableMarkdownText }} />
        </div>
      ) : null}
      {!streaming ? (
        <div
          className="aui-msg-actions"
          data-reader-ai-actions=""
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 同Question多版Answer切换(仍在Current窗口；真正开新窗用下面"开New conversation") */}
          <MessageBranchPicker kind="answer" />
          <button
            type="button"
            className="aui-action-btn aui-action-btn-branch"
            onPointerDown={(e) => {
              // 只 stopPropagation, 不要 preventDefault, no则可能丢 click
              e.stopPropagation();
            }}
            onClick={(e) => {
              void handleBranch(e);
            }}
            disabled={Boolean(branchBusy || forking || !onBranchFromAnswer)}
            aria-label="从此Answer开New conversation"
            title="Copy到此Answer为止的上文, 开一个New conversation继续问(原对话不变, 避免上下文污染)"
          >
            {forking ? (
              <Loader2 className="aui-spin" size={13} strokeWidth={2.4} aria-hidden />
            ) : (
              <GitBranch size={13} strokeWidth={2.4} aria-hidden />
            )}
            {forking ? "branch中..." : "开New conversation"}
          </button>
          <ActionBarPrimitive.Root className="aui-action-bar" hideWhenRunning>
            <ActionBarPrimitive.Reload asChild>
              <button
                type="button"
                className="aui-action-btn"
                aria-label="重新生成Answer"
                title="同一Question再生成一版Answer(仍在Current窗口)"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <RefreshCw size={13} strokeWidth={2.4} aria-hidden />
                Retry
              </button>
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </div>
      ) : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessageWithBranch() {
  return (
    <MessagePrimitive.Root className="aui-msg aui-msg-user">
      <div className="aui-msg-bubble">
        <MessagePrimitive.Parts
          components={{
            Text: () => {
              const { text } = useMessagePartText();
              return <div className="aui-md-plain">{text}</div>;
            },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyState() {
  const thread = useThreadRuntime();
  return (
    <div className="aui-empty">
      <div className="aui-empty-mascot" aria-hidden>
        <span className="aui-empty-mascot-face">
          <Sparkles size={22} strokeWidth={1.9} />
        </span>
      </div>
      <h2 className="aui-empty-title">Ready when you are. What can I help with?</h2>
      <p className="aui-empty-sub">Answers use the current document search. Click citations to jump pages.</p>
      <div className="aui-suggestions" role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.prompt}
              type="button"
              className="aui-suggestion"
              onClick={() => {
                void thread.append(item.prompt);
              }}
            >
              <Icon size={15} strokeWidth={2} aria-hidden className="aui-suggestion-icon" />
              <span className="aui-suggestion-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReaderAssistantThread({
  jobId = "",
  citationsByMessageId = {},
  progressByMessageId = {},
  contentByMessageId = {},
  streamingAssistantId = "",
  isRunning = false,
  onJumpCitation,
  onBranchFromAnswer,
  branchBusy = false,
}: ReaderAssistantThreadProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useViewportStickBottom(viewportRef, branchBusy);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (branchBusy) {
      el.dataset.suppressAutoscroll = "1";
    } else {
      delete el.dataset.suppressAutoscroll;
    }
  }, [branchBusy]);

  const ctx = useMemo<AskUiContextValue>(
    () => ({
      jobId,
      citationsByMessageId,
      progressByMessageId,
      contentByMessageId,
      streamingAssistantId,
      isRunning,
      onJumpCitation,
      onBranchFromAnswer,
      branchBusy,
    }),
    [
      jobId,
      citationsByMessageId,
      progressByMessageId,
      contentByMessageId,
      streamingAssistantId,
      isRunning,
      onJumpCitation,
      onBranchFromAnswer,
      branchBusy,
    ],
  );

  const messageComponents = useMemo(
    () => ({
      UserMessage: UserMessageWithBranch,
      AssistantMessage,
    }),
    [],
  );

  // None模型 Key 时禁止输入/Send(与主pages一致: 只认Settings → credentials)
  const [credTick, setCredTick] = useState(0);
  useEffect(() => {
    const bump = () => setCredTick((n) => n + 1);
    window.addEventListener("focus", bump);
    window.addEventListener("storage", bump);
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("storage", bump);
      document.removeEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    };
  }, []);
  void credTick;
  const missingLlmKey = !hasModelApiKey();

  return (
    <AskUiContext.Provider value={ctx}>
      <ThreadPrimitive.Root className={`aui-thread${missingLlmKey ? " is-llm-locked" : ""}`}>
        <ThreadPrimitive.Viewport
          ref={viewportRef}
          className="aui-viewport"
          data-reader-ai-viewport="true"
          turnAnchor="top"
          // branch/切会话时Close库内 autoScroll, 避免整列Jump to底像"刷新"
          autoScroll={!branchBusy}
          scrollToBottomOnRunStart={!branchBusy}
        >
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages components={messageComponents} />

          <ThreadPrimitive.ScrollToBottom className="aui-scroll-bottom" asChild>
            <button type="button" className="aui-scroll-bottom-btn" aria-label="Scroll to latest">
              <ArrowDown size={16} strokeWidth={2.25} />
            </button>
          </ThreadPrimitive.ScrollToBottom>
        </ThreadPrimitive.Viewport>

        {missingLlmKey ? (
          <div className="aui-composer aui-composer-locked" role="alert">
            <p className="aui-llm-lock-msg">{MISSING_MODEL_API_KEY_MESSAGE}</p>
            <p className="aui-hint">Open Settings → API Settings on the home page and enter a model key to ask questions.</p>
          </div>
        ) : (
          <ComposerPrimitive.Root className="aui-composer" compact>
            {/* Notion 式一体圆角输入卡: 正文 + 底栏Tools */}
            <div className="aui-composer-shell">
              <ComposerPrimitive.Input
                className="aui-input"
                rows={2}
                placeholder="Ask AI anything..."
                submitOnEnter
              />
              <div className="aui-composer-toolbar">
                <span className="aui-composer-chip" title="Search scope">
                  <BookOpen size={12} strokeWidth={2.2} aria-hidden />
                  CurrentDocuments
                </span>
                {/* 停止/Send互斥占同一位: 双钮常驻会让"停止"在 95% Timeyes死按钮 */}
                <div className="aui-composer-actions">
                  <ThreadPrimitive.If running>
                    <ComposerPrimitive.Cancel asChild>
                      <button type="button" className="aui-send aui-send-stop" aria-label="Stop generation">
                        <Square size={12} strokeWidth={2.6} aria-hidden />
                      </button>
                    </ComposerPrimitive.Cancel>
                  </ThreadPrimitive.If>
                  <ThreadPrimitive.If running={false}>
                    <ComposerPrimitive.Send asChild>
                      <button type="button" className="aui-send" aria-label="Send">
                        <ArrowUp size={16} strokeWidth={2.5} aria-hidden />
                      </button>
                    </ComposerPrimitive.Send>
                  </ThreadPrimitive.If>
                </div>
              </div>
            </div>
            <p className="aui-hint">Enter Send · Shift+Enter new line · 点Answer [n] jump to page</p>
          </ComposerPrimitive.Root>
        )}
      </ThreadPrimitive.Root>
    </AskUiContext.Provider>
  );
}





