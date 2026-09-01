// AI 问答 UI：会话栏 + 消息线程 + 输入区。
// 气泡正文仍是命令式孤岛（answer-view 句柄），结构 id 与测试契约保持不变。

import { memo, useEffect } from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useReaderAiChat } from "../ai/use-reader-ai-chat.js";
import type { AiMessageEntry } from "../ai/answer-view.js";

const SUGGESTIONS = [
  "这篇文献的主要结论是什么？",
  "作者用了什么方法或模型？",
  "有哪些关键结果或数据？",
];

const AiMessage = memo(function AiMessage({ entry }: { entry: AiMessageEntry }) {
  return (
    <article
      className={`reader-ai-message reader-ai-message-${entry.role}`}
      ref={entry.view.attachRoot}
    >
      <span className="reader-ai-message-role">{entry.title}</span>
      {/* body 为 div:Markdown 会产出块级元素,不能塞进 <p> */}
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
            aria-label="切换历史对话"
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
                {session.messageCount ? session.title : `${session.title}（空）`}
              </option>
            ))}
          </select>
          <button
            id="reader-ai-new-btn"
            type="button"
            className="reader-ai-session-btn"
            title="新建对话"
            aria-label="新建对话"
            disabled={busy}
            onClick={() => void chat.newConversation()}
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden />
            <span>新对话</span>
          </button>
          <button
            id="reader-ai-delete-btn"
            type="button"
            className="reader-ai-session-btn reader-ai-session-btn-danger"
            title="删除当前对话"
            aria-label="删除当前对话"
            disabled={onlyEmptySession || busy}
            onClick={() => void chat.deleteConversation()}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden />
            <span>删除</span>
          </button>
        </div>
      ) : (
        // 契约 id 仍挂在 DOM，供测试/自动化定位（视觉上折叠）
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
          <button id="reader-ai-new-btn" type="button" className="reader-ai-session-btn" onClick={() => void chat.newConversation()}>新对话</button>
          <button id="reader-ai-delete-btn" type="button" className="reader-ai-session-btn reader-ai-session-btn-danger" disabled={onlyEmptySession} onClick={() => void chat.deleteConversation()}>删除</button>
        </div>
      )}

      <div id="reader-ai-thread" className="reader-ai-thread" aria-live="polite" ref={chat.threadRef}>
        {chat.messages.length === 0 ? (
          <div className="reader-float-ai-thread-hint" data-reader-ai-empty-hint="">
            <p>针对当前整份文档提问</p>
            <span>答案会尽量引用文中段落，可点击跳转</span>
            <div className="reader-float-ai-suggestions" role="group" aria-label="推荐问题">
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
          placeholder={disabled ? "暂不可用" : "输入问题，Enter 发送 · Shift+Enter 换行"}
          aria-label="输入问题"
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
            <span>{chat.composer.text || (ready ? "可以提问" : "")}</span>
          </span>
          <button
            id="reader-ai-submit-btn"
            type="submit"
            disabled={!canSend}
            aria-label={busy ? "生成中" : "发送"}
          >
            {busy ? (
              <>
                <Loader2 className="reader-ai-status-spin" size={14} strokeWidth={2.4} aria-hidden />
                <span>生成中</span>
              </>
            ) : (
              <>
                <Send size={14} strokeWidth={2.4} aria-hidden />
                <span>发送</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
