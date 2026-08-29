# Bản thi công di chuyển React recent-jobs + job-runtime (cốt lõi Phase 3)

> Đầu vào trực tiếp cho agent triển khai Phase 3. Được tạo từ khảo sát mức mã nguồn, sử dụng cùng kế hoạch tổng thể
> ~/.claude/plans/wondrous-baking-donut.md.

## 0. Luồng dữ liệu hiện tại (bắt buộc đọc trước khi làm việc)

Ba chuỗi, hai bộ đếm thời gian, ba kho lưu trữ:

- **Chuỗi A (thăm dò job hiện tại 1s)**: jobRuntimeFeature.startPolling → setInterval 1000ms → fetchJob/fetchJobPayload → render‑context ghi currentJobStore → ui/presentation.js renderJob → job-status-card.renderSnapshot; đồng thời notifyLibraryJobUpdated(document CustomEvent) + requestLibraryRefresh(giới hạn 4s) + secondaryResourceScheduler(ba tài nguyên events/manifest/stageActions được giới hạn tốc độ → secondaryResourceStore → renderJobSecondaryPatch).
- **Chuỗi B (danh sách thư viện)**: refreshScheduler.initialize → loader.load → phân trang tổng hợp → commit → recentJobsStatePort.batch → store-renderer → viewPort.renderList → view.js → lưới <recent-job-card>.
- **Chuỗi C (vá thẻ đang hoạt động 2.5s)**: active‑refresh kéo tối đa 6 job đang hoạt động không phải hiện tại → runtimePatches.update → statePort.replaceItem(vá cấp thẻ) → sau đó tải lại im lặng toàn bộ.
- **Cầu sự kiện (bindings.js)**: ba document CustomEvent library* → command bus → command‑handlers(vô hiệu hóa cache + vá + làm mới lệch pha 300/600/1200ms); openTranslationWorkflow tạm dừng làm mới / close tiếp tục.

**Sự kiện chính**:
- recentJobsStatePort / currentJobStore / secondaryResourceStore đã là nguồn sự thật duy nhất (storeDrivenRendering: true) – **các engine thăm dò/vá/giới hạn tốc độ giữ nguyên**, React chỉ thay thế viewPort và custom elements.
- VM của thẻ trạng thái nằm hoàn toàn trong src/js/job-status/ (logic thuần, cho phép gate).
- card-presenter.js / image-loader.js là facade tái xuất dưới features/recent-jobs/ (import từ facade là hợp lệ).
- store getSnapshot() deep‑freeze bản sao mới mỗi lần → sau notify tất cả tham chiếu item thay đổi, **subscription của thẻ không thể dựa vào so sánh tham chiếu** (xem §3).
- Hợp đồng DOM smoke phải được phản ánh từng cái một: .recent-job-item[data-job-id], #job-status-card, #status-ring-label/-value, #status-progress-ring, #job-progress-text, .status-stage-step[data-stage-key][aria-selected], #status-section.hidden, #recent-jobs-list, #recent-jobs-empty.
- recoverActiveJob(actions.js:84) không có caller sản xuất; giữ ở trạng thái ngắt kết nối.

## 1. Phán quyết từng tệp

### features/recent-jobs/(45 tệp)
- **Giữ nguyên (engine)**: state, pagination, runtime-item, runtime-patches, runtime-value-helpers, loader, commit, runtime, controller, actions, active-refresh, refresh-scheduler, refresh-environment, commands, command-handlers, bindings, library-books-resource, library-refresh-port, navigation-port, job-runtime-port, reader-port, active-job-recovery, created-job-hydration, summary-view-model, loading-state-contract, image-refresh, event-target – composition.js import và mount trực tiếp.
- **Giữ (facade)**: card-presenter.js, image-loader.js.
- **Giữ nhưng vô hiệu hóa**: store-renderer.js (vô hại dưới React viewPort, xóa ở Phase 4).
- **Giữ**: workflow-open-port.js (composition tiêm isWorkflowOpen từ workflow store).
- **Chết (xóa khi cutover)**: view.js, view-port.js, host.js, host-actions.js, render-target.js, view-state-target.js, view-state.js, list-rendering.js, list-events.js, image-hydration.js, card-markup.js, card-template.js, formatting.js, dom-contract.js. ⚠️ 5 tham số mặc định của controller/runtime/loader/commit/bindings `viewPort = createRecentJobsViewPort()` sẽ được chuyển thành bắt buộc khi cutover (test đã tiêm sẵn, không ảnh hưởng).

### features/job-runtime/(17 tệp)
**Giữ tất cả**. Chỉ các callback trong payload mountJobRuntimeFeature thay đổi (renderJob/renderJobSecondaryPatch/setText/setWorkflowSections… do composition React cung cấp). runtime-reset tiêu thụ callback tiêm từ app‑shell subdomain đã di chuyển.

### components/status/(17 tệp)+ job-status/(VM)
Toàn bộ thư mục job-status/ là VM thuần và được giữ; React import trực tiếp. Phán quyết components/status:
- job-status-card.js / -template.js / connected-.js / -rendering.js / -progress-renderer.js / -selection.js / -stage-flow.js / -substages.js / -retry.js / -snapshot.js / -presets.js / -visuals.js / -dom-contract.js / task-toolbar.js → **chết**, được thay thế bởi họ StatusCard.jsx; trong đó:
  - rendering.js buildProgressRenderModel(dòng 45-164 hàm thuần) **được sao chép** sang src/pages/home/features/status/progress-model.js (không thể import do rào cản).
  - -progress-animation.js → hook useStagedProgressAnimation(import từ job-status/status-card-progress-view-model.js; timers/displayedProgressByStage dùng useRef).
  - -animation.js(lottie 194 dòng) → hook đảo mệnh lệnh useLottieStageAnimation(desiredKey race guard + speedForProgressDelta curve được sao chép nguyên bản; resolveLottieVendorUrl import hợp lệ).
  - Bảng STAGE_ANIMATIONS trong -presets.js được sao chép vào hook; resolveVisualStageKeyForSnapshot(8 dòng) trong -visuals.js được sao chép.
  - Các vùng ẩn #job-id/#job-status/#job-stage-detail/#query-job-duration/#job-finished-at và liên kết cũ **vẫn được render** (văn bản job‑summary và smoke song song phụ thuộc vào chúng).

### components/recent-jobs/(3 tệp)
recent-job-card.js chết → RecentJobCard.jsx; presenter và image-loader **được giữ** (qua facade; cache objectURL cấp module phải được chia sẻ, React không được tạo lại).

### Chuỗi presentation ui/
presentation.js, status-surfaces-presenter.js, job-status-card-renderer.js, status-card-view-port.js, job-status-summary-presenter.js, elapsed-presenter.js, presentation-view.js, status-ring-fallback-presenter.js → chết khi cutover. Logic thuần đã nằm trong job-status/ và job/. ⚠️ Không import ui/status-surfaces-presenter.js từ pages (sẽ kéo theo chuỗi ghi DOM cũ).

## 2. Bảng thành phần React (src/pages/home/)

### features/library/
- **RecentJobsLibrary.jsx**: useStoreSnapshot(recentJobsStore) snapshot đầy đủ + useStoreSnapshot(libraryViewStore); loadMore → runtime.loadRecentJobs({reset:false}); tóm tắt dùng buildRecentJobsSummaryViewModel.
- **RecentJobCard.jsx**: memo(Card, areCardPropsEqual), props = item + onSelect/onDelete/onReader(ref ổn định); popover xác nhận xóa được nâng lên cấp Library confirmingDeleteJobId useState.
- **useRecentJobCover.js**: loadFirstRecentJobImage + recentJobRawImageUrls(facade); imageCacheVersionOf được sao chép (recent-job-card.js:12-29); bảo vệ race token; **không thu hồi khi unmount**.
- **useLibraryAutoLoad.js**: scroll passive listener + rAF, hình học ngưỡng 260px/0.35 được viết lại (~10 dòng).
- **library-view-store.js**(mới): {mode: loading|list|empty|error, message, hasMore, loadMoreLoading}; sao chép các biến thể RECENT_JOBS_VIEW_TEXT main view.
- **react-view-port.js**(mới): triển khai 10 phương thức viewPort cũ → ghi libraryViewStore; renderList bỏ qua items (React đọc trực tiếp recentJobsStore); replaceCard luôn true; bindEvents bắt handlers vào handlersRef; hasView luôn true.
- Element shape recent-jobs-dialog bị vô hiệu hóa trong main view, chết.

### features/status/
- **StatusCard.jsx**(id="job-status-card", render vào #status-section): useStoreSnapshot(statusCardStore) snapshot đầy đủ; cancel → services.jobRuntime.cancelCurrentJob().
- **StageFlow.jsx / SubstageFlow.jsx / ProgressBlock.jsx / ResultActions.jsx / StageRetry.jsx**: tất cả được điều khiển bởi VM thuần job-status/; StageRetry dispatch APP_EVENTS.retryStage.
- **useElapsedTicker.js**: tick 1s + buildElapsedViewModel(job/elapsed-view-model.js), dừng ở terminal; elapsed không lưu trong store (sẽ gây thay đổi snapshot liên tục).
- **useStageSelection.js**: selectedStageKey/manual useState; reset khi đổi job, xóa manual khi stage tiến (ngữ nghĩa selection.js:45-64).
- **status-card-store.js**(mới)+ statusCardPresenter(~80 dòng): renderMain = buildRuntimeStatusCardViewModel + buildJobStatusSummaryViewModel → setSnapshot; renderPatch gộp ba nguồn thành "tính lại VM ghi store" (điểm hội tụ ngữ nghĩa, kiểm tra chéo S9); finishedAtFallback dùng currentJobStore.

## 3. Thiết kế subscription (thăm dò 1s không render lại toàn bộ lưới)

1. Subscription đơn lưới: Thành phần Library dùng snapshot đầy đủ không selector (render lại hàm lưới rất rẻ).
2. **Memo thẻ + so sánh chữ ký**: cardSignatureOf(item) tạo chuỗi nguyên thủy (tập trường imageCacheVersionOf ∪ title/display_name/page_count/cover_url/thumbnail_url/stage_detail/runtime_status.detail); chỉ thay đổi chữ ký thẻ đang hoạt động mới kích hoạt render lại. **Không dùng subscription store riêng cho mỗi thẻ** (không có lợi).
3. Ổn định callback: onSelect v.v. tham chiếu trực tiếp action singleton composition, không dùng arrow function nội tuyến.
4. Selector phải được định nghĩa ở đầu module (use‑store getSnapshot useCallback phụ thuộc vào điều này).
5. StatusCard nhận snapshot đầy đủ; elapsed được điều khiển cục bộ bởi ticker.

Tần suất store: recentJobsStore ~1-3/s, currentJobStore 1/s, secondaryResourceStore ~3-5s, statusCardStore 1/s, libraryViewStore thưa thớt.

## 4. Vòng đời (bootstrap → composition)

**Tất cả timer nằm ngoài React** (đã tồn tại trong các engine được giữ); composition singleton cấp module, entry.jsx tạo trước khi render, tách biệt khỏi StrictMode.

Các điểm createHomeComposition():
- statusCardStore + statusCardPresenter;
- mountJobRuntimeFeature({state, api ports giữ nguyên, renderJob→presenter.renderMain, renderJobSecondaryPatch→presenter.renderPatch, setText/setWorkflowSections/… do các feature React app‑shell/upload/workflow/status-detail đã di chuyển cung cấp, shellViewPort, libraryEventPort, resetStatePort});
- createRecentJobsReactViewPort + mountRecentJobsFeature(fetch* giữ nguyên, startPolling/currentJobId từ jobRuntimeFeature, readerPort/stageAdapterPort nâng từ các tệp bootstrap tương ứng, statePort);
- Listener document: openReaderRequested (nâng payloads.js:55-68), retryStage → jobRuntimeFeature.retryStage;
- Route khởi động: URL ?job_id= bắt đầu thăm dò (nâng startup-route.js:49-59).

Giải thể ~20 tệp bootstrap (startup-route*, job-*-port, một nửa mount-job-features, main-shell-event-bindings hai dòng, v.v.), xóa khi cutover.

Đảm bảo thứ tự: composition mount trước (tải ban đầu gửi đồng bộ) → React render; useSyncExternalStore đọc lần đầu nhận giá trị hiện tại.

## 5. Hợp đồng sự kiện

- Ba document CustomEvent library*, command bus, open/close-translation-workflow, status-area-visibility-changed: **tất cả giữ nguyên**, thành phần React không tiêu thụ trực tiếp (tất cả qua store), composition bindings.js tiếp tục chạy.
- **Điều kiện tiên quyết**: feature React workflow phải tiếp tục dispatch sự kiện open/close, nếu không làm mới thư viện bị treo vĩnh viễn (rủi ro 5).
- StageRetry tiếp tục dispatch retryStage; event-name-contracts đã quét .jsx.
- Bước này đưa vào src/shared/react/use-app-event.js (cho status-detail/workflow tiêu thụ) + unit test.

## 6. Ánh xạ test

- **Giữ nguyên không đổi**: các section state/pagination/commit/loader/refresh-scheduler/active-refresh/actions/runtime-patches/commands/command-handlers trong recent-jobs.test.mjs; controller/polling/secondary/render-context trong job-runtime.test.mjs; các section VM import từ job-status/ trong status-card.test.mjs (~70%); library-* và use-store-hook.
- **Chết cùng view**: các section view/list-rendering/list-events/host/render-target/view-state/store-renderer trong recent-jobs.test.mjs; các section shell components/status trong status-card.test.mjs (buildProgressRenderModel, test progress-animation **được di chuyển** sang tệp pages mới, assertion không đổi); các section phụ thuộc ui/ trong job-runtime.test.mjs.
- **Top10 mới**: ① render lưới thư viện + hợp đồng smoke; ② tương tác thẻ (chọn/xóa popover/trình đọc/bàn phím); ③ **cách ly render thẻ** (replaceItem một thẻ, 23 thẻ còn lại không thay đổi số lần render — neo hồi quy memo); ④ máy trạng thái viewPort×store; ⑤ hợp đồng StatusCard (stage flow/substage/retry/result actions/data‑status/ring ids); ⑥ ngữ nghĩa chọn stage; ⑦ animation theo giai đoạn (fake timer 120ms); ⑧ statusCardPresenter ba nguồn; ⑨ tích hợp composition (tải ban đầu, vá job‑updated, workflow suspend); ⑩ useRecentJobCover (cache/race/không thu hồi).

## 7. Thứ tự xây dựng (npm test xanh sau mỗi bước; 12 baseline tự nhiên không bị chạm trước cutover)

S1 skeleton store+viewPort+composition → S2 RecentJobCard+cover hook → S3 Library+autoload+tìm kiếm → S4 statusCardStore+presenter+kết nối jobRuntime → S5 cấu trúc tĩnh StatusCard → S6 đảo animation (lottie+staged) → S7 vòng tương tác (chọn/elapsed/hủy/retry) → S8 cầu sự kiện đầy đủ → S9 kiểm tra thủ công hai luồng (watch:js + backend thật + mock=song song) → cutover (chuyển entry, xóa tệp chết + 5 tham số mặc định, xóa section test, 4 baseline + smoke đầy đủ).

## 8. Rủi ro và biện pháp giảm thiểu

1. **Thời gian animation theo giai đoạn (cao nhất)**: displayedProgressByStage phải dùng useRef; snapshot mới quyết định continue/jump dựa trên shouldAnimateRenderPageProgress; đổi job thì reset. Dùng useState sẽ render lại mỗi tick và bắt closure cũ.
2. **Race lottie**: desiredKey triple‑check giữ nguyên; status‑section dùng CSS hidden, không unmount (instance animation vẫn sống).
3. **objectURL**: cache cấp module không bao giờ thu hồi; React unmount **không được** thu hồi; vô hiệu hóa chỉ qua invalidateRecentJobImages.
4. **Ngữ nghĩa giới hạn tốc độ làm mới**: thời điểm ghi lastRefreshAt là cố ý; không sắp xếp lại; test keep‑alive là neo.
5. **Deadlock workflow suspend**: isWorkflowOpen được tiêm từ composition đọc workflow store; test tích hợp bao phủ open→close→300ms refresh.
6. **Placeholder khung hình đầu**: presenter phải ghi store đồng bộ trong chuỗi startPolling (nếu không sẽ flash trống, baseline status‑dialog phát hiện).
7. **Hợp đồng DOM**: bao gồm biến CSS --status-ring-percent, --status-substage-count, aria‑selected, data‑stage‑key; hằng số dom‑ids + test hợp đồng khẳng định từng id.
8. **Sàn deep clone**: chi phí hiện tại đã chịu; không dùng items.find trong selector riêng thẻ.
9. **Phá vỡ tham số mặc định**: cutover thay đổi 5 chỗ thành bắt buộc.
10. **Hội tụ renderPatch**: Diff toàn thẻ React tương đương về lý thuyết; S9 kiểm tra chéo với mock=song song + hai đường dẫn failure task.

## Tệp chính
- features/recent-jobs/controller.js(điểm tiêm viewPort)
- features/job-runtime/controller.js(hợp đồng payload engine thăm dò)
- job-status/status-card-runtime-source.js(nguồn VM thẻ trạng thái duy nhất)
- components/status/job-status-card.js(baseline phản chiếu hành vi StatusCard.jsx)
- src/shared/react/use-store.js(nền tảng subscription)
