import test from "node:test";
import assert from "node:assert/strict";
import {
  clearThreadBranchSnapshot,
  loadThreadBranchSnapshot,
  saveThreadBranchSnapshot,
  threadBranchStorageKey,
  visiblePathFromSnapshot,
} from "../src/js/reader/ai/thread-branch-store.ts";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

test("threadBranchStorageKey scopes by job", () => {
  assert.equal(
    threadBranchStorageKey("job-1"),
    "retainpdf.reader.ai.thread-branch.v1:job:job-1",
  );
  assert.equal(
    threadBranchStorageKey(""),
    "retainpdf.reader.ai.thread-branch.v1:job:anonymous",
  );
});

test("save/load/clear branch tree with siblings + headId", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-branch";
  clearThreadBranchSnapshot(jobId);

  const snapshot = {
    version: 1,
    headId: "a2",
    items: [
      { parentId: null, message: { id: "u1", role: "user", content: "问什么？" } },
      {
        parentId: "u1",
        message: {
          id: "a1",
          role: "assistant",
          content: "回答 A",
          citations: [{ ref: 1, block_id: "p001-b0001" }],
          status: { type: "complete", reason: "stop" },
        },
      },
      {
        parentId: "u1",
        message: {
          id: "a2",
          role: "assistant",
          content: "回答 B",
          status: { type: "complete", reason: "stop" },
        },
      },
    ],
  };

  saveThreadBranchSnapshot(jobId, snapshot);
  const loaded = loadThreadBranchSnapshot(jobId);
  assert.ok(loaded);
  assert.equal(loaded.headId, "a2");
  assert.equal(loaded.items.length, 3);
  assert.equal(loaded.items[1].message.citations[0].block_id, "p001-b0001");

  const path = visiblePathFromSnapshot(loaded);
  assert.deepEqual(
    path.map((m) => m.id),
    ["u1", "a2"],
  );

  clearThreadBranchSnapshot(jobId);
  assert.equal(loadThreadBranchSnapshot(jobId), null);
});

test("load normalizes running status to cancelled", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-running";
  mem.setItem(
    threadBranchStorageKey(jobId),
    JSON.stringify({
      version: 1,
      headId: "a1",
      items: [
        { parentId: null, message: { id: "u1", role: "user", content: "q" } },
        {
          parentId: "u1",
          message: {
            id: "a1",
            role: "assistant",
            content: "半截",
            status: { type: "running" },
          },
        },
      ],
    }),
  );
  const loaded = loadThreadBranchSnapshot(jobId);
  assert.equal(loaded.items[1].message.status.type, "incomplete");
  assert.equal(loaded.items[1].message.status.reason, "cancelled");
});

// 审计 P2-10 回归锁:旧 job 级快照回退不得把 A 会话内容 hydrate 进 B 会话
test("legacy job-key fallback only serves the job's sticky conversation", async () => {
  const { saveStoredConversationId } = await import("../src/js/reader/ai/conversation-store.ts");
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-stale";
  const snapshot = {
    version: 1,
    headId: "a1",
    items: [
      { parentId: null, message: { id: "u1", role: "user", content: "A 会话的问题" } },
      { parentId: "u1", message: { id: "a1", role: "assistant", content: "A 会话的回答" } },
    ],
  };
  // 造一份"无印章"的真旧快照(仅 job key)
  saveThreadBranchSnapshot(jobId, snapshot, "");
  // 粘性会话 = conv-A
  saveStoredConversationId({ jobId }, "conv-A");

  assert.ok(loadThreadBranchSnapshot(jobId, "conv-A"), "粘性会话可用旧快照");
  assert.equal(loadThreadBranchSnapshot(jobId, "conv-B"), null, "其它会话不得吃到旧快照");
});

test("conversation stamp rejects cross-conversation snapshots", () => {
  const mem = new MemoryStorage();
  globalThis.localStorage = mem;
  const jobId = "job-stamp";
  const snapshot = {
    version: 1,
    headId: "a1",
    items: [{ parentId: null, message: { id: "a1", role: "assistant", content: "内容" } }],
  };
  saveThreadBranchSnapshot(jobId, snapshot, "conv-A");
  const loaded = loadThreadBranchSnapshot(jobId, "conv-A");
  assert.equal(loaded?.conversationId, "conv-A", "新快照带归属印章");
  // 手工把 A 的快照塞到 B 的 key 下(模拟任何形式的错位),印章不符必须拒绝
  globalThis.localStorage.setItem(
    threadBranchStorageKey(jobId, "conv-B"),
    globalThis.localStorage.getItem(threadBranchStorageKey(jobId, "conv-A")),
  );
  assert.equal(loadThreadBranchSnapshot(jobId, "conv-B"), null, "印章不符拒绝 hydrate");
});
