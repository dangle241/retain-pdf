// 4 hidden credential inputs (blueprint risk 1 core wiring point) — 3a HeroUpload/WorkflowPanel
// upload form reads .value from these DOM nodes to submit jobs; 3b this domain responsible
// for keeping them in two-way sync with default-state-port.js singleton.
//
// Rendered only in this one place (WorkflowPanel.jsx has already replaced the original 4 static
// placeholder inputs with this component, comment states "hidden credential inputs managed by 3b
// credentials domain mirroring") — entire codebase allows only this one instance; duplicate
// rendering creates duplicate DOM ids.
//
// Controlled (different from blueprint's original plan of "uncontrolled ref with
// mirrorCredentialsToHiddenInputs"; this is intentional, reason below): directly subscribe to
// credentialsStatePort.store to render value — testing (jsdom + React 18/19 host diff)
// confirms: once React renders <input defaultValue> and external code overwrites it with bare
// `node.value = x` via mirrorCredentialsToHiddenInputs, if *any* sibling component in that
// subtree re-renders and commits (HeroUpload is committing almost every second during
// UploadProgress), React's form element controlled-state recovery logic quietly pulls .value
// back to defaultValue(""), silently clearing the just-saved token — not a test artifact,
// reproducible in production (token disappears mid-upload). Making credentialsStatePort directly
// drive value= eliminates this class of issues at the root: store is the sole source of truth,
// DOM is only a projection, no "external bare write vs React recovery" race. The
// mirrorToDom (mirrorCredentialsToHiddenInputs) side effect in default-state-port.js still
// fires normally (called through browser.js internally), now only redundant but harmless — the
// truly effective write path is the store subscription here.

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { hidden: HIDDEN_IDS } = CREDENTIAL_DOM_IDS;

function selectCredentials(snapshot) {
  return snapshot.credentials;
}

export function HiddenCredentialInputs() {
  const services = useHomeServices();
  const credentials = useStoreSnapshot(services.ports.credentialsStatePort.store, selectCredentials);

  return (
    <>
      <input id={HIDDEN_IDS.ocrProvider} name="ocr_provider" type="hidden" value={credentials.ocrProvider || "paddle"} readOnly />
      <input id={HIDDEN_IDS.paddleToken} name="paddle_token" type="hidden" value={credentials.paddleToken || ""} readOnly />
      <input id={HIDDEN_IDS.modelApiKey} name="api_key" type="hidden" value={credentials.modelApiKey || ""} readOnly />
    </>
  );
}





