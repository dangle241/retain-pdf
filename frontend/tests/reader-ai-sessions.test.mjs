import test from "node:test";
import assert from "node:assert/strict";
import { createReaderAiHistoryStore } from "../src/js/reader/ai/chat-history-store.js";
import {
  deriveSessionTitle,
  summarizeSessions,
  trimSessions,
} from "../src/js/reader/ai/chat-sessions-view-model.js";

function memoryStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, `${v}`),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const KEY = "retainpdf-ai-chat-v1:job-1";

// ===== view-model pure logic =====

test("Session title: take first user message and trim, placeholder if empty", () => {
assert.equal(deriveSessionTitle({ messages: [] }), "New conversation");
  assert.equal(
    deriveSessionTitle({ messages: [{ role: "assistant", text: "先回答" }, { role: "user", text: "  卤素锂交换是什么  " }] }),
"What is halogen-lithium exchange?",
  );
  const long = deriveSessionTitle({ messages: [{ role: "user", text: "一二三四五六七八九十一二三四五六七八九十" }] });
  assert.ok(long.endsWith("…") && long.length <= 19);
});

test("Session summary: sort by updatedAt descending and mark active", () => {
  const summaries = summarizeSessions({
    activeId: "s-b",
    sessions: [
      { id: "s-a", updatedAt: 100, messages: [{ role: "user", text: "旧" }] },
      { id: "s-b", updatedAt: 200, messages: [] },
    ],
  });
  assert.deepEqual(summaries.map((s) => s.id), ["s-b", "s-a"]);
  assert.equal(summaries[0].active, true);
  assert.equal(summaries[0].messageCount, 0);
assert.equal(summaries[1].title, "Old");
});

test("Session limit truncation: keep most recently updated when exceeding limit, and keep active", () => {
  const sessions = Array.from({ length: 25 }, (_, i) => ({ id: `s-${i}`, updatedAt: i }));
  const kept = trimSessions({ sessions, activeId: "s-0" }, 20);
  assert.equal(kept.length, 20);
assert.ok(kept.some((s) => s.id === "s-0"), "Oldest but active session is kept");
});

// ===== store:Backward compatible single session layer =====

test("Single session layer: save/load/clear act on current session", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  assert.deepEqual(store.load(), { messages: [], history: [] });
  store.save({
    messages: [{ role: "user", text: "问题" }, { role: "assistant", text: "**答**", citations: [{ ref: 1, block_id: "b-1" }] }],
    history: [{ role: "user", content: "问题" }],
  });
  const loaded = store.load();
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.messages[1].citations[0].block_id, "b-1");
  store.clear();
  assert.deepEqual(store.load(), { messages: [], history: [] });
});

// ===== store: multi-session layer =====

test("Multi-session: create/switch/delete and active migration", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  store.save({ messages: [{ role: "user", text: "会话A" }], history: [] });
  const idA = store.activeSessionId();

  const idB = store.newSession();
  assert.notEqual(idA, idB);
assert.equal(store.activeSessionId(), idB, "After creation, active points to new session");
assert.deepEqual(store.load(), { messages: [], history: [] }, "New session is empty");
  store.save({ messages: [{ role: "user", text: "会话B" }], history: [] });

  assert.equal(store.listSessions().length, 2);

  // Switch back A
  const backToA = store.switchSession(idA);
assert.equal(backToA.messages[0].text, "Session A");
  assert.equal(store.activeSessionId(), idA);

// Delete A → active falls to B
  const afterDelete = store.deleteSession(idA);
  assert.equal(store.listSessions().length, 1);
assert.equal(afterDelete.messages[0].text, "Session B");
  assert.equal(store.activeSessionId(), idB);
});

test("Delete last session: add an empty session instead of leaving empty", () => {
  const storage = memoryStorage();
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  store.save({ messages: [{ role: "user", text: "唯一" }], history: [] });
  const only = store.activeSessionId();
  const after = store.deleteSession(only);
  assert.deepEqual(after, { messages: [], history: [] });
assert.ok(store.activeSessionId(), "Still has an empty session as active");
  assert.equal(store.listSessions().length, 1);
});

test("Compatibility with old single-session format: automatically migrates to one session on first read", () => {
  const storage = memoryStorage({
    [KEY]: JSON.stringify({ messages: [{ role: "user", text: "旧数据" }], history: [{ role: "user", content: "旧数据" }] }),
  });
  const store = createReaderAiHistoryStore({ jobId: "job-1", storage });
  const loaded = store.load();
assert.equal(loaded.messages[0].text, "Old data");
assert.equal(loaded.history[0].content, "Old data");
assert.equal(store.listSessions().length, 1, "Old data migrated to single session");
});

test("No jobId / no storage: multi-session interface silently degrades without throwing", () => {
  const noJob = createReaderAiHistoryStore({ jobId: "", storage: memoryStorage() });
  assert.equal(noJob.enabled, false);
  assert.deepEqual(noJob.listSessions(), []);
  assert.equal(noJob.newSession(), "");
  assert.doesNotThrow(() => noJob.deleteSession("x"));
  assert.deepEqual(noJob.switchSession("x"), { messages: [], history: [] });
});
