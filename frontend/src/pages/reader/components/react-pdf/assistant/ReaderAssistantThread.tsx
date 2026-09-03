// assistant-ui Reader Q&A: separate Progress from body; on Done, render Markdown+formulas+citations all at once.

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

/** Notion sidebar-style suggestions: icon + short title */
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
  /** Store body bypass: ensures streaming tokens render immediately */
  contentByMessageId?: Record<string, string>;
  /** Current assistant id being generated (bypasses status to prevent aui from not refreshing running state) */
  streamingAssistantId?: string;
  isRunning?: boolean;
  onJumpCitation?: (citation: AiCitationLike) => void;
  /** Open a new conversation window from the assistant's Answer (copy history up to that point) */
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
  // aui sometimes doesn't map ExternalStore's status to useMessage; fall back to bypass id
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
      // Don't force-scroll to bottom on branch/session remount, otherwise it feels like a refresh and jump
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
    // Only stick to bottom on first mount and when not suppressed
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
  // Prefer metadata.custom (stable); fall back to store map
  const citations = meta.citations.length
    ? meta.citations
    : (citationsByMessageId[meta.storeId] || citationsByMessageId[meta.messageId] || []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Streaming: prefer contentByMessageId (store/bypass direct), avoid aui Parts cache causing "render only after answer completes"
  const storeText =
    contentByMessageId[meta.storeId]
    || contentByMessageId[meta.messageId]
    || "";
  // Don't trim trailing content during streaming, to avoid half-sentences being dropped; trim after Done
  const bodyText = streaming
    ? `${storeText || text || ""}`
    : `${storeText || text || ""}`.trim();
  // On branch remount, id changes but body is the same: use cache to avoid pending flash
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

  // Streaming: sync lightweight HTML, never go through MathJax async step (otherwise it "displays only after writing finishes")
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

    // Revoke blob URLs from previous round's hydrate before overwriting (re-rendering repeatedly generates new blobs;
    // old ones would leak until page close — audit P1-5)
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

  // On unmount (switch message/close floating window), revoke blobs for file bubbles
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
 * - path: follow-up path under the same Answer with multiple entries
 * - answer: multiple retry versions of the same Question
 */
function MessageBranchPicker({ kind }: { kind: "path" | "answer" }) {
  const label = kind === "path" ? "branch" : "Answer";
  return (
    <BranchPickerPrimitive.Root
      className={`aui-branch-picker aui-branch-picker-${kind}`}
      hideWhenSingleBranch
      title={kind === "path" ? "Switch to another path branched from this Answer" : "Switch to a different version of this Answer"}
    >
      <span className="aui-branch-kind" aria-hidden>
        {label}
      </span>
      <BranchPickerPrimitive.Previous asChild>
        <button
          type="button"
          className="aui-branch-btn"
          aria-label={kind === "path" ? "Previous branch" : "Previous Answer"}
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
          aria-label={kind === "path" ? "Next branch" : "Next Answer"}
        >
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
}

/**
 * Open a "new conversation window" from the assistant's Answer:
 * Copy the history from root to this Answer into a new conversation, original session unchanged (similar to ChatGPT Branch in new chat).
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
      // Wait for the click to fully end before applying full-screen shield, must never cover the button on pointerdown
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });
      armReaderAiClickShield(1200, { overlayDelayMs: 0 });
      lockReaderAiNavigation(1200);
      const ok = await onBranchFromAnswer(assistantId);
      if (!ok) {
        // Give some feedback on failure too (sessionError is in the conversation entries)
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
          {/* Switch between multiple versions of the same Question's Answer (still in the current window; for a truly new window use "Open new conversation" below) */}
          <MessageBranchPicker kind="answer" />
          <button
            type="button"
            className="aui-action-btn aui-action-btn-branch"
            onPointerDown={(e) => {
              // Only stopPropagation, don't preventDefault — otherwise clicks may be lost
              e.stopPropagation();
            }}
            onClick={(e) => {
              void handleBranch(e);
            }}
            disabled={Boolean(branchBusy || forking || !onBranchFromAnswer)}
            aria-label="Open new conversation from this Answer"
            title="Copy conversation up to this Answer, open a new conversation to continue asking (original conversation unchanged, avoids context pollution)"
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
                aria-label="Regenerate answer"
                title="Regenerate another version of the answer to the same question (still in the current window)"
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

  // No model key: disable input/Send (consistent with main page: only accepts Settings → credentials)
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
          // Disable autoScroll in the library during branch/session switch, to avoid the whole column jumping to bottom like a "refresh"
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
            {/* Notion-style unified rounded input card: body + bottom toolbar Tools */}
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
                {/* Stop/Send are mutually exclusive and share the same position: having both buttons permanently visible would make "Stop" a dead button 95% of the time */}
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
            <p className="aui-hint">Enter to send · Shift+Enter new line · Click Answer [n] to jump to page</p>
          </ComposerPrimitive.Root>
        )}
      </ThreadPrimitive.Root>
    </AskUiContext.Provider>
  );
}





