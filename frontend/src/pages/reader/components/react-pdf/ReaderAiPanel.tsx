// AI Q&A floating window:assistant-ui Thread + Session window + Branch windowing

import { useCallback, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Sparkles } from "lucide-react";
import {
  isReaderAiNavigationLocked,
  type AiCitationLike,
} from "../../external.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";
import { ReaderAssistantThread } from "./assistant/ReaderAssistantThread.js";
import { ReaderConversationBar } from "./assistant/ReaderConversationBar.js";
import { useReaderAskRuntime } from "./assistant/use-reader-ask-runtime.js";

export type ReaderAiPanelProps = {
  open: boolean;
  jobId: string;
  sourceOnly: boolean;
  onClose: () => void;
/** page_idx is 0-based; reader uses goToPage(page_idx+1) */
  onJumpCitation: (citation: AiCitationLike) => void;
};

export function ReaderAiPanel({
  open,
  jobId,
  sourceOnly,
  onClose,
  onJumpCitation,
}: ReaderAiPanelProps) {
  const enabled = open && !sourceOnly && Boolean(jobId);
  const {
    runtime,
    citationsByMessageId,
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    sessions,
    activeConversationId,
    sessionBusy,
    sessionError,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
  } = useReaderAskRuntime({
    jobId,
    enabled,
  });

  const [branchNotice, setBranchNotice] = useState("");

  const handleBranch = useCallback(async (assistantId: string) => {
    setBranchNotice("");
    const ok = await branchFromAnswer(assistantId);
    if (ok) {
      setBranchNotice(
        "New conversation saved (fork-n-Original): Copied from above. Conversation unchanged. Top list toggles.",
      );
      window.setTimeout(() => setBranchNotice(""), 6000);
    }
  }, [branchFromAnswer]);

// Branch/Skip navigation during session lockout. PDF avoid accidental reference trigger
  const safeJumpCitation = useCallback((citation: AiCitationLike) => {
    if (isReaderAiNavigationLocked()) return;
    onJumpCitation(citation);
  }, [onJumpCitation]);

  return (
    <ReaderFloatShell
      id="reader-ai-panel"
      open={open}
title="AI Q&A"
      subtitle="Based on current document"
      titleIcon={<Sparkles size={14} strokeWidth={2.1} aria-hidden />}
      storageKey="retainpdf.reader.ai-float.pos.v1"
ariaLabel="Reading Q&A"
      width={400}
      className={`reader-float-ai${sessionBusy ? " is-session-busy" : ""}`}
      onClose={onClose}
    >
      {sourceOnly || !jobId ? (
        <div className="reader-float-ai-empty">
          <Sparkles size={22} strokeWidth={1.75} aria-hidden />
<p>Not available in source document read-only mode. AI Q&A</p>
          <span>Open the reader from the task entry and try again.</span>
        </div>
      ) : (
        <div className="reader-float-ai-body">
          <ReaderConversationBar
            sessions={sessions}
            activeId={activeConversationId}
            busy={sessionBusy}
            errorText={sessionError}
            onSwitch={switchSession}
            onNew={newSession}
            onDelete={removeSession}
            onRename={renameSession}
          />
          {branchNotice ? (
            <div className="aui-session-banner" role="status">
              {branchNotice}
            </div>
          ) : null}
          <div className="reader-float-ai-thread-wrap">
            {sessionBusy ? (
              <div
                className="aui-branch-pointer-shield"
                aria-hidden
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            ) : null}
            <AssistantRuntimeProvider runtime={runtime}>
              <ReaderAssistantThread
                jobId={jobId}
                citationsByMessageId={citationsByMessageId}
                progressByMessageId={progressByMessageId}
                contentByMessageId={contentByMessageId}
                streamingAssistantId={streamingAssistantId}
                isRunning={isRunning}
                onJumpCitation={safeJumpCitation}
                onBranchFromAnswer={handleBranch}
                branchBusy={sessionBusy}
              />
            </AssistantRuntimeProvider>
          </div>
        </div>
      )}
    </ReaderFloatShell>
  );
}
