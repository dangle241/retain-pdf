# recent-jobs + job-runtime Subdomain React Migration Blueprint(Phase 3 Core)

> Phase 3 Implementation agent Direct input. Source-level survey output., coordinate with general plan
> ~/.claude/plans/wondrous-baking-donut.md Use.

## 0. Current data flow (Must read before construction)

Three links two timers three store:

- **link A(Current Task Polling 1s)**:jobRuntimeFeature.startPolling → setInterval 1000ms → fetchJob/fetchJobPayload → render-context write currentJobStore → ui/presentation.js renderJob → job-status-card.renderSnapshot;Also notifyLibraryJobUpdated(document CustomEvent)+ requestLibraryRefresh(4s Throttle function. Reduce event frequency. Implement: `lodash.throttle`. → skipped: custom debounce, add when performance issues arise.)+ secondaryResourceScheduler(events/manifest/stageActions Three-resource rate limit. → secondaryResourceStore → renderJobSecondaryPatch)。
- **Link B(Library list)**:refreshScheduler.initialize → loader.load → pagination Aggregate → commit → recentJobsStatePort.batch → store-renderer → viewPort.renderList → view.js → <recent-job-card> Grid.
- **Link C (Active card patch 2.5s)**: active-refresh Pull max 6 Not currently active job â runtimePatches.update â statePort.replaceItem (Card-level patch) â Then full silent re-pull.
- **EventBridge(bindings.js)**: three library* document CustomEvents â Command bus â command-handlers (Cache invalidation + Patch + 300/600/1200ms Tiered refresh); openTranslationWorkflow Suspend refresh / close Restore.

**Key facts**:
- recentJobsStatePort / currentJobStore / secondaryResourceStore Already the only truthy value. (storeDrivenRendering: true)ââ**Polling/Patch/Throttle engine unchanged.**, React Replace only. viewPort With custom elements.
- status card VM All src/js/job-status/(Pure logic,Access granted.)。
- card-presenter.js / image-loader.js are features/recent-jobs/ Transshipment below facade (re-export since components/recent-jobs/), **import from facade is legal**.
- store getSnapshot() Deep-freeze new clone each time. â notify After all item Replace all references., **Card subscription cannot rely on reference equality** (see Â§3).
- smoke DOM Mirror each contract.:.recent-job-item[data-job-id]、#job-status-card、#status-ring-label/-value、#status-progress-ring、#job-progress-text、.status-stage-step[data-stage-key][aria-selected]、#status-section.hidden、#recent-jobs-list、#recent-jobs-empty。
- recoverActiveJob(actions.js:84)No production callers.,Keep disconnected.

## 1. File-by-file ruling.

### features/recent-jobs/(45 files)
- **Keep as is(Engine)**:state, pagination, runtime-item, runtime-patches, runtime-value-helpers, loader, commit, runtime, controller, actions, active-refresh, refresh-scheduler, refresh-environment, commands, command-handlers, bindings, library-books-resource, library-refresh-port, navigation-port, job-runtime-port, reader-port, active-job-recovery, created-job-hydration, summary-view-model, loading-state-contract, image-refresh, event-targetâcomposition.js Direct import and mount.
- **Retain(facade)**:card-presenter.js、image-loader.js。
- **Retain but disable**:store-renderer.js(React viewPort Harmless, delete in Phase 4).
- **Retain**:workflow-open-port.js(composition inject isWorkflowOpen read workflow store).
- **dead(delete at cutover)**:view.js, view-port.js, host.js, host-actions.js, render-target.js, view-state-target.js, view-state.js, list-rendering.js, list-events.js, image-hydration.js, card-markup.js, card-template.js, formatting.js, dom-contract.js. â ï¸ controller/runtime/loader/commit/bindings 5 Set default parameters. `viewPort = createRecentJobsViewPort()` same as commit Change to required.(Tests injected, Zero impact).

### features/job-runtime/(17 files)
**All retained** Only change is mountJobRuntimeFeature payload callback implementation of(renderJob/renderJobSecondaryPatch/setText/setWorkflowSectionsâ¦ provided by composition React implementation). runtime-reset consumes app-shell Subdomain-first migration injection callback.

### components/status/(17 files)+ job-status/(VM)
job-status/ All Directories Plain VM retained, React directly import. components/status ruling:
- job-status-card.js / -template.js / connected-.js / -rendering.js / -progress-renderer.js / -selection.js / -stage-flow.js / -substages.js / -retry.js / -snapshot.js / -presets.js / -visuals.js / -dom-contract.js / task-toolbar.js â **dead**, substituted by StatusCard.jsx Family; among them:
- rendering.js buildProgressRenderModel(45-164 Pure function) **Copy** to src/pages/home/features/status/progress-model.js(Forbidden area access denied. Check permissions. import).
  - -progress-animation.js → hook useStagedProgressAnimation(Kernel from job-status/status-card-progress-view-model.js import;timers/displayedProgressByStage use useRef)。
- -animation.js(lottie 194 lines) â Imperative Island hook useLottieStageAnimation(desiredKey Race Condition Protection + speedForProgressDelta Copy Entire Curve; resolveLottieVendorUrl Legal import).
- -presets.js STAGE_ANIMATIONS Copy table into hook; -visuals.js resolveVisualStageKeyForSnapshot(8 lines) Copy.
- Hidden area #job-id/#job-status/#job-stage-detail/#query-job-duration/#job-finished-at and legacy link **Render anyway.**(job-summary Text & parallel smoke dependency).

### components/recent-jobs/(3 files)
recent-job-card.js dead â RecentJobCard.jsx; presenter and image-loader **retained**(via facade; Module-level objectURL Cache must be shared, React No nested construction inside).

### ui/ State rendering chain
presentation.js, status-surfaces-presenter.js, job-status-card-renderer.js, status-card-view-port.js, job-status-summary-presenter.js, elapsed-presenter.js, presentation-view.js, status-ring-fallback-presenter.js â Died cutover Pure logic already exists in job-status/ and job/. â ï¸ Do not import ui/status-surfaces-presenter.js from pages(Drag into old DOM Write to Chain).

## 2. React Component table(src/pages/home/)

### features/library/
- **RecentJobsLibrary.jsx**: useStoreSnapshot(recentJobsStore) Full snapshot + useStoreSnapshot(libraryViewStore); loadMore â runtime.loadRecentJobs({reset:false}); summary uses buildRecentJobsSummaryViewModel.
- **RecentJobCard.jsx**:memo(Card, areCardPropsEqual),props = item + onSelect/onDelete/onReader(Stable reference);Delete confirmation popover Promote to Library level confirmingDeleteJobId useState。
- **useRecentJobCover.js**: loadFirstRecentJobImage + recentJobRawImageUrls(facade); imageCacheVersionOf Copy(recent-job-card.js:12-29); token Race condition prevention; **do not revoke on unmount**.
- **useLibraryAutoLoad.js**: Scroll passive listener + rAF, 260px/0.35 Threshold geometry rewrite.(~10 lines).
- **library-view-store.js**(new):{mode: loading|list|empty|error, message, hasMore, loadMoreLoading};Copy Text RECENT_JOBS_VIEW_TEXT Main view variant.
- **react-view-port.js**(new):Implement legacy. viewPort 10 Method â write libraryViewStore;renderList ignore items(React Direct read recentJobsStore);replaceCard always true;bindEvents Capture handlers to handlersRef;hasView always true.
- recent-jobs-dialog Element form disabled in main view.,Die.

### features/status/
- **StatusCard.jsx**(id="job-status-card",Render engine. Update. Optimize. #status-section):useStoreSnapshot(statusCardStore) Take Snapshot;Cancel â services.jobRuntime.cancelCurrentJob().
- **StageFlow.jsx / SubstageFlow.jsx / ProgressBlock.jsx / ResultActions.jsx / StageRetry.jsx**:All by job-status/ pure VM driven;StageRetry dispatch APP_EVENTS.retryStage.
- **useElapsedTicker.js**:1s tick + buildElapsedViewModel(job/elapsed-view-model.js), stop at final state;elapsed not in store(avoid constant snapshot changes).
- **useStageSelection.js**:selectedStageKey/manual useState;change job Reset, stage advance clear manual(selection.js:45-64 semantics).
- **status-card-store.js**(new)+ statusCardPresenter(~80 lines):renderMain = buildRuntimeStatusCardViewModel + buildJobStatusSummaryViewModel â setSnapshot;renderPatch Three source Unify "Recalculate. VM write store"(Semantic convergence point,S9 Cross-check);finishedAtFallback use currentJobStore.

## 3. Subscription Design(1s Polling without full-cell re-render)

1. Grid Single Subscription:Library No component selector Full snapshot(Rerender grid Function body is cheap.)。
2. **Card memo + Signature comparison**:cardSignatureOf(item) generate primitive string(imageCacheVersionOf Fieldset âª title/display_name/page_count/cover_url/thumbnail_url/stage_detail/runtime_status.detail);Re-render only when active card signature changes.**Do not do per-card store subscription**(Earnings: 0).
3. Callback stable:onSelect Direct quote. composition Singleton actions,Inline arrows removed.
4. selector Must be defined at module top level.(use-store getSnapshot useCallback Depend on it).
5. StatusCard full snapshot;elapsed by ticker Local Drive.

store frequency:recentJobsStore ~1-3 times/s, currentJobStore 1 time/s, secondaryResourceStore 3-5s Remove. Unnecessary. Simplify.statusCardStore 1 time/s, libraryViewStore Remove unnecessary elements. Optimize.

## 4. Lifecycle(bootstrap â composition)

**All timers remain outside React**(Live in retention engine);composition Module-level singleton,entry.jsx Create first, then render, with StrictMode Code duplication. Refactor. Extract common functionality.

createHomeComposition() Key points:
- statusCardStore + statusCardPresenter;
- mountJobRuntimeFeature({state, api Port unchanged., renderJob→presenter.renderMain, renderJobSecondaryPatch→presenter.renderPatch, setText/setWorkflowSections/…Pre-migration tasks incomplete. Verify completion. app-shell/upload/workflow/status-detail React feature provides, shellViewPort, libraryEventPort, resetStatePort});
- createRecentJobsReactViewPort + mountRecentJobsFeature(fetch* As is, startPolling/currentJobId connect jobRuntimeFeature, readerPort/stageAdapterPort Pan bootstrap Implement corresponding file., statePort);
- document listener:openReaderRequested(Pan payloads.js:55-68), retryStage â jobRuntimeFeature.retryStage;
- startup route:URL ?job_id= Start polling.(migrate startup-route.js:49-59).

Dissolved bootstrap files ~20 (startup-route*, job-*-port, mount-job-features Halfmain-shell-event-bindings Two lines equal),cutover Deleted.

Order Guarantee:composition mount first(First load Sync Send)â React render;useSyncExternalStore First read gets present value.

## 5. Event contract

- library* Three document CustomEventCommand Busopen/close-translation-workflow, status-area-visibility-changed:**All preserved as-is**,React Components do not directly consume(Run All store),bindings.js in composition Continue running.
- **Precondition**:workflow React Feature must continue dispatch open/close events,Otherwise library refresh hangs indefinitely.(Risk 5).
- StageRetry continue dispatch retryStage;event-name-contracts scanned .jsx。
- Step implemented. src/shared/react/use-app-event.js(provide status-detail/workflow consumption)+ Unit Test.

## 6. Test mapping

- **No change needed. System handles keep-alive.**:recent-jobs.test.mjs state/pagination/commit/loader/refresh-scheduler/active-refresh/actions/runtime-patches/commands/command-handlers sections;job-runtime.test.mjs controller/polling/secondary/render-context sections;status-card.test.mjs VM sections import since job-status/ (Approximately seventy percent.);library-* and use-store-hook.
- **View destroy â skipped: cleanup, add when necessary.**:recent-jobs.test.mjs view/list-rendering/list-events/host/render-target/view-state/store-renderer sections;status-card.test.mjs components/status Shell Section(buildProgressRenderModel, progress-animation use case**Boundary: prohibit**Point to New pages files,Assert unchanged);job-runtime.test.mjs depends on ui/ Invalid input. Please provide valid text.
- **New Top10**:â Library Grid Rendering+smoke contract;â¡Card Interactions(select/delete popover/reader/keyboard);â¢**Card Render Isolation**(replaceItem Single Card, remaining 23 Card render count unchanged.ââmemo Regression Anchor);â£viewPortÃstore state machine;â¤StatusCard contract(stage flow/substage/retry/result actions/data-status/ring ids);â¥stage selection semantics;â¦staged Animation(fake timer 120ms);â§statusCardPresenter Three source;â¨composition integration(first screen load, job-updated Patch needed. Identify issue. Apply fix. Test.workflow Suspend);â©useRecentJobCover(Cache invalidation fail. Implement proper cache keys./Race condition/do not revoke).

## 7. Construction sequence(Each step npm test All green;12 Baseline immutable before cutover.)

S1 store+viewPort+composition prototype â S2 RecentJobCard+cover hook â S3 Library+autoload+Search â S4 statusCardStore+presenter+connect jobRuntime â S5 StatusCard static structure â S6 Animation Island(lottie+staged) â S7 Interaction loop(select/elapsed/cancel/retry) â S8 EventBridge Full â S9 Dual-track manual verification(watch:js + real backend + mock=parallel)â cutover(Switch entry, delete dead files.+5 Handle default params, delete test section.4 Baseline+Full Set smoke).

## 8. Risk mitigation

1. **staged Animation timing(Highest)**:displayedProgressByStage Required useRef;New snapshot by shouldAnimateRenderPageProgress Decide to resume./Jump detected. Investigate cause.;change job resetMisuse. useState Incomplete. tick re-render+Closure stale value.
2. **lottie race condition**:desiredKey Triple-check retain original;status-section use CSS hidden rather than unmount(Animation instance lifetime semantics).
3. **objectURL**:Module-level cache never revoke,React unmount **must not** revoke;invalidate Walk only invalidateRecentJobImages.
4. **Refresh throttle semantics**:lastRefreshAt Write timing is intentional.,Disable reflow;Test segment keepalive is anchor.
5. **workflow Suspend deadlock**:isWorkflowOpen by composition Inject read workflow store;Integration test coverage. OpenâCloseâ300ms Refresh.
6. **First frame placeholder**:presenter must write store within startPolling synchronous chain(Otherwise, flash empty card.,status-dialog Capture Baseline).
7. **DOM contract**:contains --status-ring-percent, --status-substage-count CSS Variables, aria-selected, data-stage-key;dom-ids constants + Contract Testing Step id Assert.
8. **Deep clone floor**:Current state bears equivalent cost.;do not use items.find in per-card selector.
9. **Default parameter breaks chain.**:cutover same commit change 5 Required.
10. **renderPatch convergence**:React Whole card diff Theoretically equivalent;S9 with mock=parallel + Failed task dual-path comparison.

## Key Files
- features/recent-jobs/controller.js(viewPort Injection point)
- features/job-runtime/controller.js(Polling Engine payload contract)
- job-status/status-card-runtime-source.js(status card unique VM source)
- components/status/job-status-card.js(StatusCard.jsx Behavior mirroring baseline)
- src/shared/react/use-store.js(Subscription Base)
