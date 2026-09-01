// assistant-ui progress separate from body. Render once on completion. Markdown+Formula+Quote.

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

/** Notion Sidebar suggestion: icon + Short title */
const SUGGESTIONS: Array<{
  prompt: string;
  label: string;
  icon: typeof BookOpen;
}> = [
  {
    prompt: "Summarize the core content of this paper in a few sentences.",
    label: "Summarize this page document",
    icon: BookOpen,
  },
  {
    prompt: "What is the main conclusion of this paper?",
    label: "Extract Main Conclusions",
    icon: ListTree,
  },
  {
    prompt: "What methods or models did the author use?",
    label: "Method & Model Review",
    icon: FlaskConical,
  },
  {
    prompt: "Key results or data?",
    label: "Highlight Key Results",
    icon: Sparkles,
  },
];

export type ReaderAssistantThreadProps = {
  jobId?: string;
  citationsByMessageId?: Record<string, AiCitationLike[]>;
  progressByMessageId?: Record<string, string>;
  /** store Body bypass, ensure streaming. token Renders immediately */
  contentByMessageId?: Record<string, string>;
/** Generating... assistant idBypass route needed. Implement status to avoid aui No refresh running) */
  streamingAssistantId?: string;
  isRunning?: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  /** Open new session from assistant answer (copy history to this point) */
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
// aui status sometimes not ExternalStore; cast to useMessageBypass route. Simplify. id Fallback
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
// Branch/session switch remount: disable forced scroll-to-bottom to prevent jarring UX. "Refresh and redirect"
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
    // First mount only, incomplete suppress Sticky bottom
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
      <span>{label || "Thinking...…"}</span>
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
// Prioritize metadata.customStable; rollback. store map
  const citations = meta.citations.length
    ? meta.citations
    : (citationsByMessageId[meta.storeId] || citationsByMessageId[meta.messageId] || []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Streaming: priority contentByMessageId（store/Bypass passthrough to avoid aui Parts Caused by caching「Render after answering.」
  const storeText =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  // Disable streaming. trim Trailing padding prevents truncation; resume after completion. trim
  const bodyText = streaming
    ? `${storeText || text || ""}`
    : `${storeText || text || ""}`.trim();
// Branch remount: id cache to prevent flash. pending
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

  // Streaming: sync lightweight HTMLNever walk. MathJax Async (otherwise「Render after write complete.」）
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

// Revoke previous round before overwriting hydrate blob URL; repeated re-renders generate new blobs,
// Old leaks on page close. â Audit P1-5)
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

  // Uninstall (switch message/Close floating window) Recycle this bubble's blob
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
 * Sibling node switcher.
 * - pathmultiple follow-up paths for the same answer
 * - answerMultiple retry versions of the answer for the same question
 */
function MessageBranchPicker({ kind }: { kind: "path" | "answer" }) {
const label = kind === "path" ? "Branch" : "Answer";
  return (
    <BranchPickerPrimitive.Root
      className={`aui-branch-picker aui-branch-picker-${kind}`}
      hideWhenSingleBranch
      title={kind === "path" ? "Switch to forked paths" : "Switch answer versions"}
    >
      <span className="aui-branch-kind" aria-hidden>
        {label}
      </span>
      <BranchPickerPrimitive.Previous asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "Previous branch" : "previous answer"}
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
          aria-label={kind === "path" ? "Next Branch" : "next answer"}
        >
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

/**
* Start from assistant answer. "New Session Window":
* Copy root â this answer history to new conversation; original session remains unchanged (similar to ChatGPT Branch in new chat).
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
// Wait for click: apply full-screen overlay only after complete finish. Never during. pointerdown covers button
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });
      armReaderAiClickShield(1200, { overlayDelayMs: 0 });
      lockReaderAiNavigation(1200);
      const ok = await onBranchFromAnswer(assistantId);
      if (!ok) {
        // Add feedback delay on failure.sessionError In session bar)
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
      {streaming && !progress && !hasBody ? <ThinkingRow label="思考中…" /> : null}
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
          {/* Switch multi-version answers for same question (current window; open new window below「Start new conversation.」） */}
          <MessageBranchPicker kind="answer" />
          <button
            type="button"
            className="aui-action-btn aui-action-btn-branch"
            onPointerDown={(e) => {
// Only stopPropagation, do not preventDefault; otherwise click causes data loss
              e.stopPropagation();
            }}
            onClick={(e) => {
              void handleBranch(e);
            }}
            disabled={Boolean(branchBusy || forking || !onBranchFromAnswer)}
            aria-label="Start new conversation from this answer"
            title="Copy the above context up to this answer, start a new conversation to continue asking (keep original conversation unchanged to avoid context pollution)."
          >
            {forking ? (
              <Loader2 className="aui-spin" size={13} strokeWidth={2.4} aria-hidden />
            ) : (
              <GitBranch size={13} strokeWidth={2.4} aria-hidden />
            )}
            {forking ? "In branch…" : "New conversation"}
          </button>
          <ActionBarPrimitive.Root className="aui-action-bar" hideWhenRunning>
            <ActionBarPrimitive.Reload asChild>
              <button
                type="button"
                className="aui-action-btn"
                aria-label="Re-generate answer. Simplify further."
                title="Regenerate an answer for the same question (still in the current window)"
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
<h2 className="aui-empty-title">Ready and waiting, how can I help you?</h2>
      <p className="aui-empty-sub">No document provided. Attach or paste the document to retrieve answers. · Click citation to navigate.</p>
<div className="aui-suggestions" role="group" aria-label="Suggested Questions">
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

  // No model Key Input disabled/Send (matches homepage: settings only) → Credentials)
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
// Branch/Close in-library on session switch. autoScroll avoids column jumping to bottom like "Refresh"
          autoScroll={!branchBusy}
          scrollToBottomOnRunStart={!branchBusy}
        >
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages components={messageComponents} />

          <ThreadPrimitive.ScrollToBottom className="aui-scroll-bottom" asChild>
            <button type="button" className="aui-scroll-bottom-btn" aria-label="scroll to latest">
              <ArrowDown size={16} strokeWidth={2.25} />
            </button>
          </ThreadPrimitive.ScrollToBottom>
        </ThreadPrimitive.Viewport>

        {missingLlmKey ? (
          <div className="aui-composer aui-composer-locked" role="alert">
            <p className="aui-llm-lock-msg">{MISSING_MODEL_API_KEY_MESSAGE}</p>
<p className="aui-hint">Go home. "Settings â API Settings" to enter model Key, then ask questions.</p>
          </div>
        ) : (
          <ComposerPrimitive.Root className="aui-composer" compact>
            {/* Notion Integrated rounded input card: body + Bottom bar tools */}
            <div className="aui-composer-shell">
              <ComposerPrimitive.Input
                className="aui-input"
                rows={2}
placeholder="Use AI to do anything..."
                submitOnEnter
              />
              <div className="aui-composer-toolbar">
                <span className="aui-composer-chip" title="Search Scope">
                  <BookOpen size={12} strokeWidth={2.2} aria-hidden />
                  Current document
                </span>
                {/* 停止/Mutual exclusion shares same bit: dual-button persistence causes「停止」在 95% Time is a dead button */}
                <div className="aui-composer-actions">
                  <ThreadPrimitive.If running>
                    <ComposerPrimitive.Cancel asChild>
<button type="button" className="aui-send aui-send-stop" aria-label="Stop generating">
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
            <p className="aui-hint">Enter Send · Shift+Enter Newline · Answer [n] Go</p>
          </ComposerPrimitive.Root>
        )}
      </ThreadPrimitive.Root>
    </AskUiContext.Provider>
  );
}
