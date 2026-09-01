import { TRANSLATION_PROVIDER_DEFINITION } from "../../config/providers.js";
import {
  runDeepSeekBalanceCheck,
  runDeepSeekConnectivityCheck,
  summarizeDeepSeekBalance,
} from "./validation.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";

const DEEPSEEK_LOW_BALANCE_THRESHOLD = 2;

function deepSeekBalanceAmount(result) {
  const infos = Array.isArray(result?.balance_infos) ? result.balance_infos : [];
  return infos.reduce((sum, item) => {
    const raw = `${item?.total_balance ?? ""}`.replace(/[^\d.-]/g, "");
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

export async function handleBrowserDeepSeekValidate({
  apiPrefix,
  state,
  defaultModelApiKey,
  validateDeepSeekToken,
  queryDeepSeekBalance,
  onBalanceChange,
  silent = false,
  credentialsStatePort = defaultCredentialsStatePort,
  viewPort,
}: any) {
  const {
    apiKeyInput,
    modelBaseUrlInput,
  } = viewPort.elements();
  const storedCredentials = credentialsStatePort.getCredentials?.() || {};
  const modelApiKey = apiKeyInput?.value?.trim() || storedCredentials.modelApiKey || defaultModelApiKey?.() || "";
  if (apiKeyInput && !apiKeyInput.value && modelApiKey) {
    apiKeyInput.value = modelApiKey;
  }
  const baseUrl = modelBaseUrlInput?.value?.trim() || "";
  credentialsStatePort.resetDeepSeekBalance?.();
  onBalanceChange?.();
  if (!modelApiKey) {
    return { ok: false, status: "missing_key" };
  }
  viewPort.setTopUpVisible(false);
  if (!silent) {
    viewPort.setValidationMessage("Detecting... DeepSeek and balance…");
  }
  const result = await runDeepSeekConnectivityCheck({
    apiPrefix,
    apiKey: modelApiKey,
    baseUrl,
    validateDeepSeekToken,
    setDeepSeekValidationMessage: viewPort.setValidationMessage,
    showResult: false,
  });
  if (result.ok) {
    const balance = await runDeepSeekBalanceCheck({
      apiPrefix,
      apiKey: modelApiKey,
      baseUrl,
      queryDeepSeekBalance,
    });
    if (balance.status === "unsupported_provider") {
      if (!silent) {
viewPort.setValidationMessage("DeepSeek available", "valid");
      }
      return balance;
    }
    if (balance.status === "network_error") {
      if (!silent) {
        viewPort.setValidationMessage("DeepSeek Available, balance query failed.", "valid");
      }
      return balance;
    }
    const balanceSummary = summarizeDeepSeekBalance(balance);
    const balanceAmount = deepSeekBalanceAmount(balance);
    credentialsStatePort.setDeepSeekBalance?.(balanceAmount, true);
    onBalanceChange?.();
    const shouldTopUp = balanceAmount < DEEPSEEK_LOW_BALANCE_THRESHOLD;
    viewPort.setTopUpVisible(shouldTopUp);
    viewPort.setValidationMessage(
      `DeepSeek Available,${balanceSummary}${shouldTopUp ? "balance below 2 元" : ""}`,
      balance.is_available ? "valid" : "error",
    );
    return balance;
  }
  viewPort.setTopUpVisible(false);
  if (!silent) {
    viewPort.setValidationMessage(
      result.summary || TRANSLATION_PROVIDER_DEFINITION.validationNetworkMessage,
      "error",
    );
  }
  return result;
}
