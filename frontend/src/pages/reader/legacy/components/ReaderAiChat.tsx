// AI Q&A UI: chat bar + message thread + input area.
// Bubble body still an imperative island (answer-view handles it), structural ids and
// test contracts stay unchanged.

import { memo, useEffect } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useReaderAiChat } from "../ai/use-reader-ai-chat.js";
import type { AiMessageEntry } from "../ai/answer-view.js";

const SUGGESTIONS = [
  "What are the main conclusions of this paper?",
  "What methods or models did the authors use?",
  "What are the key results or data?",
];

const AiMessage = memo(function AiMessage({ entry }: { entry: AiMessageEntry }) {
  return (
    <article
      className={`reader-ai-message reader-ai-message-${entry.role}`}
      ref={entry.view.attachRoot}
    >
      <span className="reader-ai-message-role">{entry.title}</span>
      {/* body is div: Markdown produces block-level elements, cannot stuff into <p> */}
      <div
        className="reader-ai-message-body-el"
        data-reader-ai-message-body="1"
        ref={entry.view.attachBody}
      ></div>
    </article>
  );
});

export function ReaderAiChat({ ports, controllerRef = null }) {
  const chat = useReaderAiChat(ports);
  useEffect(() => {
    if (controllerRef) {
      controllerRef.current = chat;
    }
  });
  const busy = chat.composer.phase === "busy";
  const disabled = chat.composer.phase === "disabled";
  const ready = chat.composer.phase === "ready" || chat.composer.phase === "idle";
  const onlyEmptySession = chat.sessions.length <= 1 && !(chat.sessions[0]?.messageCount);
  const showSessionChrome = chat.sessions.length > 1 || Boolean(chat.sessions[0]?.messageCount);
  const canSend = !disabled && !busy && `${chat.input || ""}`.trim().length > 0;

  function askSuggestion(text: string) {
    if (disabled || busy) return;
    chat.setInput(text);
    void chat.submit(text);
  }

  return (
    <div className="reader-ai-chat-root" data-reader-ai-chat="">
      {showSessionChrome ? (
        <div className="reader-ai-sessions" data-reader-ai-sessions="">
          <select
            id="reader-ai-session-select"
            className="reader-ai-session-select"
            aria-label="Switch conversation"
            value={chat.activeSessionId}
            disabled={chat.sessions.length <= 1 || busy}
            onChange={(event) => {
              const id = `${event.target.value || ""}`;
              if (id && id !== chat.activeSessionId) {
                void chat.switchConversation(id);
              }
            }}
          >
            {chat.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.messageCount ? session.title : `${session.title} (empty)`}
              </option>
            ))}
          </select>
          <button
            id="reader-ai-new-btn"
            type="button"
            className="reader-ai-session-btn"
            title="New conversation"
            aria-label="New conversation"
            disabled={busy}
            onClick={() => void chat.newConversation()}
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden />
            <span>New conversation</span>
          </button>
          <button
            id="reader-ai-delete-btn"
            type="button"
            className="reader-ai-session-btn reader-ai-session-btn-danger"
            title="Delete current conversation"
            aria-label="Delete current conversation"
            disabled={onlyEmptySession || busy}
            onClick={() => void chat.deleteConversation()}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden />
            <span>Delete</span>
          </button>
        </div>
      ) : (
        // Contract ids still on DOM for test/automation locate (visually collapsed)
        <div className="reader-ai-sessions is-collapsed" data-reader-ai-sessions="" hidden>
          <select
            id="reader-ai-session-select"
            className="reader-ai-session-select"
            aria-hidden="true"
            tabIndex={-1}
            value={chat.activeSessionId}
            onChange={() => {}}
          >
            {chat.sessions.map((session) => (
              <option key={session.id} value={session.id}>{session.title}</option>
            ))}
          </select>
          <button id="reader-ai-new-btn" type="button" className="reader-ai-session-btn" onClick={() => void chat.newConversation()}>New conversation</button>
          <button id="reader-ai-delete-btn" type="button" className="reader-ai-session-btn reader-ai-session-btn-danger" disabled={onlyEmptySession} onClick={() => void chat.deleteConversation()}>Delete</button>
        </div>
      )}

      <div id="reader-ai-thread" className="reader-ai-thread" aria-live="polite" ref={chat.threadRef}>
        {chat.messages.length === 0 ? (
          <div className="reader-float-ai-thread-hint" data-reader-ai-empty-hint="">
            <p>Ask about the entire document</p>
            <span>Answers will cite paragraphs, click to navigate</span>
            <div className="reader-float-ai-suggestions" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="reader-float-ai-suggestion"
                  disabled={disabled || busy}
                  onClick={() => askSuggestion(text)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {chat.messages.map((entry) => (
          <AiMessage key={entry.id} entry={entry} />
        ))}
      </div>

      <form
        className="reader-ai-composer"
        data-reader-ai-composer=""
        onSubmit={(event) => {
          event.preventDefault();
          void chat.submit();
        }}
      >
        <textarea
          id="reader-ai-input"
          placeholder={disabled ? "Not ready" : "Enter question, Enter sends · Shift+Enter new line"}
          aria-label="Enter question"
          rows={2}
          value={chat.input}
          disabled={disabled}
          onChange={(event) => chat.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!busy && !disabled) {
                void chat.submit();
              }
            }
          }}
        ></textarea>
        <div className="reader-ai-composer-foot">
          <span
            id="reader-ai-status"
            className={`reader-ai-status is-${chat.composer.phase}${busy ? " is-busy" : ""}`}
          >
            {busy ? (
              <Loader2 className="reader-ai-status-spin" size={13} strokeWidth={2.4} aria-hidden />
            ) : null}
            <span>{chat.composer.text || (ready ? "Ready to answer" : "")}</span>
          </span>
          <button
            id="reader-ai-submit-btn"
            type="submit"
            disabled={!canSend}
            aria-label={busy ? "Generating" : "Send"}
          >
            {busy ? (
              <>
                <Loader2 className="reader-ai-status-spin" size={14} strokeWidth={2.4} aria-hidden />
                <span>Generating</span>
              </>
            ) : (
              <>
                <Send size={14} strokeWidth={2.4} aria-hidden />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


