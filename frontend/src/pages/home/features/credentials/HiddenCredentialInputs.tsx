// 4 Hide credentials input (Blueprint Risk 1 Core wiring point) ââ 3a HeroUpload/WorkflowPanel
// Upload form reads these DOM Node's .value Submit task;3b This domain handles their alignment with
// default-state-port.js Singleton bidirectional sync.
//
// Render here only.(WorkflowPanel.jsx Original 4 Static placeholder input Switch to cost
// Component, Specify in comment. "Hide credentials. input taken over by 3b credentials Domain mirror") ââ Full codebase
// Allow only this copy.,Repeated renders create duplicates. DOM id。
//
// Controlled (differs from blueprint original plan "uncontrolled ref attached to mirrorCredentialsToHiddenInputs",
// Deliberate implementation adjustment. See below): directly subscribe to credentialsStatePort.store for rendering
// value ââ verified (jsdom + React 18/19 host diff) confirmed, React Rendered
// <input defaultValue> Once invoked by external code mirrorCredentialsToHiddenInputs's
// raw `node.value = x` rewrite, as long as any sibling component in this subtree re-renders on submit
// (HeroUpload Submits every second during upload progress),React form elements
// controlled state recovery logic will silently pull .value back to defaultValue(""), effectively
// token Silent clear.——Not a test artifact.,Reproducible in production.(Mid-upload token Disappear)。
// Let credentialsStatePort direct drive value = Eliminate this category of issues at the root.:
// store is the single source of truth, DOM Projection only, no "Hardcode external vs React Reclaim" competition.
// Side effect of default-state-port.js mirrorToDom(mirrorCredentialsToHiddenInputs)
// Triggers normally(browser.js Internal call chain),Currently redundant but harmless——Effective
// Write path here. store subscription.

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
