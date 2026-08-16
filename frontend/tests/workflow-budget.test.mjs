import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTranslationBudgetState,
} from "../src/js/features/workflow/budget.js";
import { isOfficialDeepSeekBaseUrl } from "../src/js/config/providers.js";

test("translation budget blocks DeepSeek submission when estimated cost exceeds balance", () => {
  const budget = resolveTranslationBudgetState({
    pageRanges: "",
    uploadedPageCount: 533,
    balanceCny: 1,
    balanceChecked: true,
    needsTranslation: true,
  });

  assert.equal(budget.visible, true);
  assert.equal(budget.blocking, true);
  assert.equal(budget.pageCount, 533);
  assert.equal(budget.estimatedCost.toFixed(2), "8.79");
  assert.equal(budget.message, "Ước tính ¥8.79 · 533 trang · Số dư ¥1.00");
  assert.equal(budget.topUpUrl, "https://platform.deepseek.com/top_up");
});

test("DeepSeek budget guard only applies to the official DeepSeek endpoint", () => {
  assert.equal(isOfficialDeepSeekBaseUrl("https://api.deepseek.com/v1"), true);
  assert.equal(isOfficialDeepSeekBaseUrl("https://api.openai.com/v1"), false);
  assert.equal(isOfficialDeepSeekBaseUrl("https://llm.example.test/v1"), false);
});
