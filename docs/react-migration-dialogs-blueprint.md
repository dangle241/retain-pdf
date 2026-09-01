# Phase 3 Dialog Group Construction Blueprint(StatusDetail / Credentials / Glossaries / ReaderDialog / AppUpdate / developer / artifact-downloads)

> Coordinate with the master plan. ~/.claude/plans/wondrous-baking-donut.md、docs/react-migration-recent-jobs-blueprint.md、
> docs/react-migration-legacy-audit.md Use. Do not duplicate recent-jobs Blueprint Scope.

## 0. Global discovery(Seven-domain sharing,Read before construction)

1. dom-contract constants (STATUS_DETAIL_DIALOG/CREDENTIAL_DOM_IDS/GLOSSARY_DOM_IDS/READER_DIALOG_IDS/APP_UPDATE_IDS) Keep as-is, use directly as JSX idââVisual baseline according to id Precise click, assert door_access == 'allowed' â skipped: error handling, add when needed., **Cannot rename/Do not change CSS Modules**.
2. **Native `<dialog>` Semantic retention required. Next step: Identify critical components.** (showModal()/close()). `app-shell/view.js:bindDialogBackdropClose` Fix id One-time getElementByIdââIf the dialog "Mount on open." Will permanently expire. **Countermeasure: 5 Dialog always mounted (entry Feature already exists. Remove.), useEffect driven by open to showModal/close, Use builtin function. Skip external library. backdrop-close onClick, Do not rely on legacy. bindDialogBackdropClose.**
3. Open/close state across subtrees.: Add `src/pages/home/state/dialog-store.js` general factory `createDialogStore()` (open(payload)/close()/subscribe/getState), One instance per dialog., Reference reader's drawer-store.js mode.
4. **`AppSettingsDialog` Three-tab shell** (API settings/glossary/update), Internal button enabled Credentials/Glossaries/AppUpdate Ownership Suggestion: Merge CredentialsDialog Contractor, Name `SettingsHubDialog.jsx`.
5. **artifact-downloads Risk identified. Assess impact. Mitigate.**: document Delegate click event. Simplify: Use native event listeners. + `setLinkBusy` directly modify DOM, Button host distribution recent-jobs' ResultActions.jsx With blueprint StatusDetailDialog. If the parent component re-renders due to store Re-render overwrites changes. "Downloading..." copy. **Option two is recommended**: Add `artifact-download-busy-store.js`, Each button subscribes to itself. actionId Shard (see Â§7.5).
6. APP_EVENTS:openBrowserCredentials(Credentials)、refreshGlossaries(Glossaries)、openReaderRequested(ReaderDialog,by existing library-search React island dispatch)All Classics useAppEvent(name, handler) consume,Event name unchanged.

## 1. StatusDetailDialog(1,511 rows/18 File)

- **Data Source Independent**: Parallel to blueprint statusCardStore of recent-jobs, no merge.ââstatus-detail itself fetch (events/diagnostics/resumePlan), StatusCard does not need these fields. Both share the same renderJob Callback injection point.
- Open Trigger: ResultActions.jsx's `#status-detail-btn` onClick direct call `openStatusDetailDialog("overview")` (Non-event, direct function call).
- **Decision points**: controller.js/overview-coordinator/translation-tab-coordinator/translation-data-port/resume-actions/formatters (pure formatting)/status-detail/{snapshot,utils,history,events} (pure functions) all **Retain**; translation-renderer.js/navigation-view-port.js/dialog-view-port.js/translation-view-port.js/resume-view-port.js/view.js **Dead**; components/dialogs/status-detail-dialog*.js 6 files dead (only STATUS_DETAIL_DIALOG constant retained).
- **markup→JSX Max rewrite count for this domain.**(history.js/events.js/translation-renderer.js Three places HTML String concatenation → Structured JSX),Run visual baselines section by section.,Cannot do it all at once.
- New store: `status-detail-store.js` (overview section + translation section) + `status-detail-dialog-store.js` (open/activeTab).
- Component:StatusDetailDialog.jsx(4 tab Persistent Render hidden Properties,Don't uninstall)、StageHistoryList/EventsList(New Structured JSX)、TranslationDebugTab Family,useRerunAction。
- acceptance:status-dialog-failed / status-dialog-translation Two visual baselines(cutover threshold)。

## 2. CredentialsDialog (1,673 lines/22 files, Project-wide max single feature)

- **`default-state-port.js` Singleton must be reused as-is.** (Do not rebuild)ââits mirrorToDom Synchronize side effects 4 Hidden input (ocr_provider/mineru_token/paddle_token/api_key), these inputs are read by 3a upload form. **Highest risk point.: composition Build hidden copy per domain. input Causes "filled in settings token, Read failure during upload." Silent failure.**
- Judgment: state.js/default-state-port.js/hidden-input-dom-port.js/selectors-port.js/validation.js/deepseek-flow.js/ocr-readiness-flow.js/persistence.js/dialog-values.js **Retain**; browser-view-port.js/deepseek-view-port.js/view.js/dialog-sync.js/dialog-elements-port.js/setup-mode-port.js **Dead**.
- `updateCredentialGate` (Upload button locked state) suggest **Full handover 3a**, Local only expose Read-only subscription.
- `developer-auth-dialog.js` **Dead code(Orphan component)**:except its own registration and APP_DIALOG_BACKDROP_IDS External List Reference,No open files in entire codebase./Validation Logic Wiring**Suggestions Phase 4 Find user before delete/Confirm product once.**,Do not discard silently.(Possible placeholder requirement.)。
- Suggest also implementing Â§0.4's SettingsHubDialog.jsx and Â§0.3's dialog-store Factory (Other domain reuse).

## 3. GlossariesDialog (533 lines)

- controller.js Business function (reload/select/save/delete/export/applyImport) Retain, state Move away from mutable objects. glossaries-store.js.
- entries Table imperative DOM Row ops refactored to structured arrays. + mapââ**when level==="preserve", target Leave blank for backfill. source Preserve legacy semantics verbatim.**.
- `refreshWorkflowGlossaries({force, selectedId})` is a 3a workflow Domain callback dependency (Reverse call), composition Wait for assembly. workflow Domain ready.; Keep default parameters optional (no-op fallback).

## 4. ReaderDialog iframe Host (919 lines, high risk level)

- **postMessage Verify contract byte-by-byte.**: type `"retainpdf-reader-progress"`, Field `{type,percent,text,stage}`, `stage==="ready" && percent>=100` â 180ms Hide Later; Source Verification `isTrustedWindowMessage(event, frameWindow)` No change. Already with Phase2b's src/pages/reader/entry.jsx Sender verified.
- `reader-embedded` body class Processed by Phase2b reader Handle on your side.,No action required on the host side.,just continue using real `<iframe>`。
- **Download button dead code detection requires runtime review.**: READER_DIALOG_BUTTON_IDS Host download button missing in current template. (Already replaced completely by Phase2b's ReaderDownloadMenu.jsx), controller.js's handleSourceDownload and four other functions that appear to be dead codeââ**It is recommended to implement agent Run once mock Open Real Scene reader-dialog confirm, Then decide whether to crop.**.
- **iframe src Switching is required. ref Imperative processing**(setAttribute/removeAttribute),Do not leave JSX Declarative src Property(React diff edge case risk)。
- "Separate" agent,Follow. Credentials/StatusDetail Next,Do not parallelize with other domains.(Interfere conflict. Resolve: Rename windows.)。

## 5. AppUpdateBanner (491 lines)

- Completely self-contained., localStorage 24h TTL cache + Automatic background check.
- **two places DOM Across two hosts** (Button at SettingsHubDialog "update" tab, detail dialog now in app-shell-header.js)ââReact Merge suggestions into one AppUpdateBanner.jsx, Add SettingsHubDialog "update" tab under, needs to confirm with 3a AppShellHeader Clear Residue update-dialog Template (Otherwise repeat. id violate access restriction).

## 6. developer panel (133 lines, Cannot construct independently.)

- **Hard dependency 3a workflow domain**: Form fields (model/Workflow/Concurrency parameters) All reads and writes come from workflowPorts, developer Domain triggers Easter egg only. (Keyboard sequence "bbpp") + tab Switch + Open dialog.
- Easter egg logic (Exclude form element targets + 4 Sliding window character matching) must be migrated as-is to useDeveloperEasterEgg() hook, Note StrictMode effect Idempotent/cleanup (Globally Unique document keydown Listen).
- **Recommend against standalone project.,Merge workflow Contractor or acting as workflow Post-completion cleanup tasks**。

## 7. artifact-downloads (264 lines)

- No standalone visual component.,is mounted on composition Root behavior hook:useArtifactDownloadsBinding()。
- 7 Fixed id (#download-btn/#markdown-bundle-btn/#status-markdown-bundle-btn/#source-pdf-btn/#pdf-btn/#markdown-btn/#markdown-raw-btn) Distribution recent-jobs' ResultActions.jsx and StatusDetailDialog.
- **Option 2(Recommend)**:setLinkBusy Source missing. Provide text. artifact-download-busy-store.js,Each button subscribes to itself. actionId Sharding. Must match recent-jobs Blueprint contractor negotiation interface——If counterpart refuses to change,Revert to plan one.(ResultActions Button package React.memo,props Contains only enabled/url,Excludes high-frequency fields)。

## 8. Dependency matrix and agent Split suggestions

| Domain | Dependency (Read) | Dependents (Write/coupling) |
|---|---|---|
| StatusDetailDialog | job-runtime Retain Engine state(non- statusCardStore) | ResultActions need to call its openStatusDetailDialog |
| CredentialsDialog | none | 3a HeroUpload Read hidden input + Go to settings button requires it. open() |
| GlossariesDialog | None | 3a workflow's refreshWorkflowGlossaries Callback (Reverse); developer Glossary dropdown |
| ReaderDialog | Phase2b postMessage Sender (Read-Only Contract) | recent-jobs Card "Compare Reading" Button; library-search Island Incident |
| AppUpdateBanner | None | 3a AppShellHeader Remove old template fragments. |
| developer | Hard dependency 3a workflow | None |
| artifact-downloads | None | recent-jobs Download button link correct. id (+ Plan 2 Subscription) |

**Suggested 4 Implementation agents**:
1. CredentialsDialog (+ SettingsHubDialog shell + dialog-store Base)ââ Largest and most self-consistent, Priority.
2. GlossariesDialog + AppUpdateBanner Merge (Compact, Share SettingsHubDialog host).
3. StatusDetailDialog(+artifact-downloads Option 1 Fallback,treat recent-jobs Subject to contractor's acceptance of Option 2.)。
4. ReaderDialog Separate (Small scale, high risk, immediately following 1/3, do not parallelize with other domains).
developer Return to Panel workflow Wrap-up,No separate project.

**Critical prerequisites: This blueprint 4 Domain and 3a (app-shell/upload/workflow) Tight coupling** (hidden input Share, Settings button trigger point AppShellHeader Template location, refreshWorkflowGlossaries Callback)ââ**Wait required. 3a Dispatch after landing.**, Otherwise API mismatch requires rework.

## Key files
- src/js/components/dialogs/status-detail-dialog-dom-contract.js
- src/js/features/status-detail/controller.js
- src/js/features/credentials/default-state-port.js
- src/js/features/reader-dialog/controller.js
- src/pages/reader/entry.jsx(postMessage Sender verification baseline)
- src/pages/reader/state/drawer-store.js(dialog-store Reference Mode)
- src/shared/react/use-store.js
