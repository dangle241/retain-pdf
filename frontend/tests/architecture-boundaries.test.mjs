import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PROJECT_ROOT = process.cwd();
const JS_ROOT = join(PROJECT_ROOT, "src/js");
const FEATURE_ROOT = join(JS_ROOT, "features");
const BOOTSTRAP_ROOT = join(JS_ROOT, "bootstrap");
const SOURCE_ROOTS = {
  api: join(JS_ROOT, "api"),
  bootstrap: BOOTSTRAP_ROOT,
  components: join(JS_ROOT, "components"),
  config: join(JS_ROOT, "config"),
  contracts: join(JS_ROOT, "contracts"),
  desktop: join(JS_ROOT, "desktop"),
  features: FEATURE_ROOT,
  job: join(JS_ROOT, "job"),
  jobDetail: join(JS_ROOT, "job-detail"),
  jobStatus: join(JS_ROOT, "job-status"),
  reader: join(JS_ROOT, "reader"),
  state: join(JS_ROOT, "state"),
  statusDetail: join(JS_ROOT, "status-detail"),
  ui: join(JS_ROOT, "ui"),
  utils: join(JS_ROOT, "utils"),
};
const APP_ENTRYPOINTS = [
  join(PROJECT_ROOT, "app.js"),
  join(PROJECT_ROOT, "app-bundle-entry.js"),
];
const VIEW_IMPORT_PATTERN = /from\s+["']\.\/view\.js["']/;
const LEGACY_STATE_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+state\/store\.js["']/;
const ROOT_COMPAT_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+(?:state|job)\.js["']/;
const ROOT_PROVIDER_CONFIG_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+provider-config\.js["']/;
const ROOT_CONFIG_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+config\.js["']/;
const ROOT_TEMPLATES_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+templates\.js["']/;
const ROOT_DOM_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+dom\.js["']/;
const ROOT_MAIN_IMPORT_PATTERN = /from\s+["'](?:\.\/src\/js\/main\.js|(?:\.\.\/)+main\.js)["']/;
const JOBS_API_BARREL_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+api\/jobs\.js["']/;
const APP_FRAMEWORK_BARREL_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+app-framework(?:\/index\.js)?["']/;
const FEATURE_UI_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+ui\//;
const FEATURE_UPLOAD_CONSTANTS_IMPORT_PATTERN = /from\s+["'](?:\.\.\/)+config\/upload-constants\.js["']/;
const WEBAWESOME_USAGE_PATTERN = /@awesome\.me\/webawesome|<wa-|wa-(?:button|dialog|progress|badge|card|progress-ring|progress-bar)\b|WebAwesome|Web Awesome/;
const SHARED_DIALOG_SHELL_SELECTOR_PATTERN = /^\s*\.(?:desktop-dialog|desktop-shell|desktop-head|desktop-body|dialog-close-btn)(?:\s|[,{:#.])/m;
const APP_UPDATE_SELECTOR_PATTERN = /^\s*\.app-update-[\w-]+(?:\s|[,{:#.])/m;
const LIBRARY_SHELL_SELECTOR_PATTERN = /^\s*(?:\.(?:page|app-shell|topbar|app-shell-header|library-[\w-]+|home-action-btn|brand-[\w-]+|hero(?:-[\w-]+)?)(?:\s|[,{:#.])|#recent-jobs-list\.library-grid\b|\.recent-jobs-more-row\s+#load-more-jobs-btn\b)/m;
const API_PREFIX_FROM_ROOT_CONSTANTS_PATTERN = /import\s*{[^}]*API_PREFIX[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const UPLOAD_CONSTANTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_FILE_LABEL|FRONT_MAX_BYTES|FRONT_MAX_PAGE_COUNT)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const MODEL_CONSTANTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_MODEL|DEFAULT_BASE_URL|DEFAULT_MODEL_VERSION)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const STORAGE_KEYS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:BROWSER_CONFIG_STORAGE_KEY|DEVELOPER_CONFIG_STORAGE_KEY)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const WORKFLOW_DEFAULTS_FROM_ROOT_PATTERN = /import\s*{[^}]*(?:DEFAULT_MODE|DEFAULT_LANGUAGE|DEFAULT_RULE_PROFILE|DEFAULT_RENDER_MODE|DEFAULT_TYPST_FONT_FAMILY|DEFAULT_PDF_COMPRESS_DPI|DEFAULT_TRANSLATED_PDF_NAME|DEFAULT_BODY_FONT_SIZE_FACTOR|DEFAULT_BODY_LEADING_FACTOR|DEFAULT_INNER_BBOX_SHRINK_X|DEFAULT_INNER_BBOX_SHRINK_Y|DEFAULT_INNER_BBOX_DENSE_SHRINK_X|DEFAULT_INNER_BBOX_DENSE_SHRINK_Y|DEFAULT_FONT_UNIFY_MODE|DEFAULT_WORKERS|DEFAULT_BATCH_SIZE|DEFAULT_CLASSIFY_BATCH_SIZE|DEFAULT_COMPILE_WORKERS|DEFAULT_TIMEOUT_SECONDS)[^}]*}\s*from\s+["'](?:\.\.\/)+constants\.js["']/s;
const BOOTSTRAP_EXTERNAL_IMPORT_PATTERN = /from\s+["']\.\.\/(?:features|ui|api|state)\/|from\s+["']\.\.\/(?:config|constants)\.js["']/;
// Phase 3 home cutover Removed most src/js/bootstrap/(227 Manual DI In the port file
// 226 items); The only existing file is reader-dialog-runtime-port.js (reader iframe Contract required,
// see src/js/reader/downloads/resolve.js) The following two lists each had 30~130 Map entries
// File deletedâPhase 4 Filter to keep only existing entries. If new files land again in bootstrap/ they will be
// Access control tests correctly blocked.,Force explicit decision on allowlist re-addition.
const BOOTSTRAP_GROUPED_PORT_FILES = [];
const BOOTSTRAP_GROUPED_PORT_DISCOVERY_ALLOWLIST = new Set([]);

const BOOTSTRAP_EXTERNAL_IMPORT_ALLOWLIST = new Set([
  "reader-dialog-runtime-port.js",
  "reader-dialog-runtime-port.ts",
]);

function isSourceFile(filePath) {
  return filePath.endsWith(".ts")
    || filePath.endsWith(".tsx")
    || filePath.endsWith(".js")
    || filePath.endsWith(".jsx");
}

/** Source file migrated TS Tests can still write after foo.jsRead actual foo.ts */
function resolveSourcePath(filePath) {
  if (existsSync(filePath)) {
    return filePath;
  }
  if (filePath.endsWith(".js")) {
    const asTs = `${filePath.slice(0, -3)}.ts`;
    if (existsSync(asTs)) return asTs;
    const asTsx = `${filePath.slice(0, -3)}.tsx`;
    if (existsSync(asTsx)) return asTsx;
  }
  if (filePath.endsWith(".jsx")) {
    const asTsx = `${filePath.slice(0, -4)}.tsx`;
    if (existsSync(asTsx)) return asTsx;
  }
  return filePath;
}

function walkFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        pending.push(join(current, entry));
      }
      continue;
    }
    if (isSourceFile(current)) {
      files.push(current);
    }
  }
  return files.sort();
}

function allPathsUnder(root) {
  const pending = [root];
  const paths = [];
  while (pending.length > 0) {
    const current = pending.pop();
    paths.push(current);
    if (!statSync(current).isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(current)) {
      pending.push(join(current, entry));
    }
  }
  return paths.sort();
}

function readRootSource(fileName) {
  return readFileSync(join(JS_ROOT, fileName), "utf8");
}

function readSource(filePath) {
  return readFileSync(resolveSourcePath(filePath), "utf8");
}

function readBootstrapSource(fileName) {
  return readSource(join(BOOTSTRAP_ROOT, fileName));
}

function readFeatureSource(featureName, fileName) {
  return readSource(join(FEATURE_ROOT, featureName, fileName));
}

function readJobRuntimeSource(fileName) {
  return readFeatureSource("job-runtime", fileName);
}

function readUiSource(fileName) {
  return readSource(join(SOURCE_ROOTS.ui, fileName));
}

function relativeToProject(filePath) {
  return relative(PROJECT_ROOT, filePath);
}

function filesUnder(...roots) {
  return roots.flatMap((root) => walkFiles(root));
}

/** Remove `import type` RematchâTS Type imports don't create runtime dependencies. view Layer dependencies */
function sourceWithoutTypeImports(source) {
  return source
    .replace(/import\s+type\s+[\s\S]*?from\s+["'][^"']+["']\s*;?/g, "")
    .replace(/import\s*\{[^}]*\}\s*from\s+["'][^"']+["']\s*;?/g, (block) => {
      // Preserve value import; if line only type Handled in previous step
      return block;
    });
}

function findMatchingImports(files, pattern) {
  return files
    .filter((file) => pattern.test(sourceWithoutTypeImports(readSource(file))))
    .map((file) => relativeToProject(file));
}

function findMatchingSources(files, pattern) {
  return files
    .filter((file) => pattern.test(readSource(file)))
    .map((file) => relativeToProject(file));
}

function stripCompatibilityReExports(source) {
  return source
    .replace(/export\s+(?:\{[\s\S]*?\}|\*)\s+from\s+["'][^"']+["'];/g, "")
    .trim();
}

function isViewBoundaryModule(filePath) {
  const fileName = filePath.split("/").pop() || "";
  return /(?:-view-port|view-port)\.(?:js|ts)$/.test(fileName)
    || /^(?:dialog-elements-port|deepseek-view-port|setup-mode-port|presenter-port|translation-view-port)\.(?:js|ts)$/.test(fileName);
}

test("source tree does not contain notebook checkpoint artifacts", () => {
  const offenders = allPathsUnder(join(PROJECT_ROOT, "src"))
    .filter((filePath) => filePath.split("/").includes(".ipynb_checkpoints"))
    .map((filePath) => relativeToProject(filePath));

  assert.deepEqual(offenders, []);
});

test("runtime frontend does not depend on WebAwesome", () => {
  const runtimeSources = [
    ...APP_ENTRYPOINTS,
    join(PROJECT_ROOT, "package.json"),
    join(PROJECT_ROOT, "package-lock.json"),
    ...walkFiles(JS_ROOT),
    ...allPathsUnder(join(PROJECT_ROOT, "src/styles")).filter((filePath) => filePath.endsWith(".css")),
  ].filter((filePath) => existsSync(filePath));
  const offenders = findMatchingSources(runtimeSources, WEBAWESOME_USAGE_PATTERN);

  assert.deepEqual(offenders, []);
});

test("shared dialog shell styles stay in dialog-shell css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/dialog-shell.css"));
  const offenders = findMatchingSources(styleSources, SHARED_DIALOG_SHELL_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

test("app update styles stay in app-update css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/pages/home/app-update.css"));
  const offenders = findMatchingSources(styleSources, APP_UPDATE_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

test("library shell styles stay in library-shell css", () => {
  const styleSources = allPathsUnder(join(PROJECT_ROOT, "src/styles"))
    .filter((filePath) => filePath.endsWith(".css"))
    .filter((filePath) => filePath !== join(PROJECT_ROOT, "src/styles/pages/home/library-shell.css"));
  const offenders = findMatchingSources(styleSources, LIBRARY_SHELL_SELECTOR_PATTERN);

  assert.deepEqual(offenders, []);
});

test("feature modules import local view.js only through explicit view boundary ports", () => {
  const offenders = findMatchingImports(walkFiles(FEATURE_ROOT), VIEW_IMPORT_PATTERN)
    .filter((file) => !isViewBoundaryModule(file));

  assert.deepEqual(offenders, []);
});

function isLegacyStateBoundaryModule(filePath) {
  const fileName = filePath.split("/").pop() || "";
  return /^(?:state|.*-state|.*-state-port|.*runtime-state-port)\.(?:js|ts)$/.test(fileName);
}

test("feature modules import legacy global state only through state boundary ports", () => {
  const offenders = findMatchingImports(walkFiles(FEATURE_ROOT), LEGACY_STATE_IMPORT_PATTERN)
    .filter((file) => !isLegacyStateBoundaryModule(file));

  assert.deepEqual(offenders, []);
});

test("feature modules do not import default ui adapters directly", () => {
  const offenders = findMatchingImports(walkFiles(FEATURE_ROOT), FEATURE_UI_IMPORT_PATTERN);

  assert.deepEqual(offenders, []);
});

test("feature modules receive upload defaults through ports", () => {
  const offenders = findMatchingImports(walkFiles(FEATURE_ROOT), FEATURE_UPLOAD_CONSTANTS_IMPORT_PATTERN);

  assert.deepEqual(offenders, []);
});

test("root compatibility barrels are removed", () => {
  const remaining = [
    "config.js",
    "constants.js",
    "dom.js",
    "job.js",
    "main.js",
    "state.js",
    "templates.js",
  ].filter((fileName) => existsSync(join(JS_ROOT, fileName)));

  assert.deepEqual(remaining, []);
});

test("job artifact helpers read runtime and upload state through artifact runtime port", () => {
  const artifactsSource = readSource(join(SOURCE_ROOTS.job, "artifacts.js"));
  const runtimePortSource = readSource(join(SOURCE_ROOTS.job, "artifact-runtime-port.js"));

  assert.equal(
    artifactsSource.includes("../features/job-runtime/current-job-state.js"),
    false,
  );
  assert.equal(
    artifactsSource.includes("../features/job-runtime/secondary-resource-cache.js"),
    false,
  );
  assert.equal(
    artifactsSource.includes("../state/upload-state.js"),
    false,
  );
  assert.match(artifactsSource, /artifact-runtime-port\.js/);
  assert.match(runtimePortSource, /createArtifactRuntimePort/);
  assert.match(runtimePortSource, /defaultArtifactRuntimePort/);
  assert.equal(runtimePortSource.includes("../ui/"), false);
  assert.equal(runtimePortSource.includes("../features/job-runtime/"), false);
  assert.equal(runtimePortSource.includes("../state/"), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.ui, "default-artifact-runtime-port.js")), false);
});

test("job layer does not keep ui presenter compatibility facades", () => {
  assert.equal(existsSync(join(SOURCE_ROOTS.job, "elapsed-renderer.js")), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.job, "workflow-visibility.js")), false);
});

test("job helpers keep job-runtime feature access behind explicit runtime ports", () => {
  const offenders = walkFiles(SOURCE_ROOTS.job)
    .map((file) => relative(SOURCE_ROOTS.job, file))
    .filter((file) => readSource(join(SOURCE_ROOTS.job, file)).includes("../features/job-runtime/"));

  assert.deepEqual(offenders, []);
});

test("job stage history presentation helpers are owned by the job layer", () => {
  const stageHistorySource = readSource(join(SOURCE_ROOTS.job, "stage-history.js"));
  const statusDetailUtilsSource = readSource(join(SOURCE_ROOTS.statusDetail, "utils.js"));
  const jobDetailOffenders = walkFiles(SOURCE_ROOTS.jobDetail)
    .filter((file) => {
      const source = readSource(file);
      return source.includes("stageHistoryDisplay")
        && source.includes("../status-detail/utils.js");
    })
    .map((file) => relativeToProject(file));

  assert.match(stageHistorySource, /stageHistoryDisplay/);
  assert.match(stageHistorySource, /resolveStageHistoryDuration/);
  assert.match(statusDetailUtilsSource, /..\/job\/stage-history\.js/);
  assert.deepEqual(jobDetailOffenders, []);
});

test("source modules read API prefix from config api constants", () => {
  const offenders = findMatchingImports(filesUnder(
    SOURCE_ROOTS.api,
    SOURCE_ROOTS.bootstrap,
    SOURCE_ROOTS.jobDetail,
    SOURCE_ROOTS.reader,
  ), API_PREFIX_FROM_ROOT_CONSTANTS_PATTERN);

  assert.deepEqual(offenders, []);
});

test("source modules read model defaults from config model constants", () => {
  const offenders = findMatchingImports(filesUnder(
    SOURCE_ROOTS.bootstrap,
    SOURCE_ROOTS.config,
    SOURCE_ROOTS.features,
  ), MODEL_CONSTANTS_FROM_ROOT_PATTERN);

  assert.deepEqual(offenders, []);
});

test("source modules read storage keys from config storage keys", () => {
  const offenders = findMatchingImports(
    walkFiles(SOURCE_ROOTS.config),
    STORAGE_KEYS_FROM_ROOT_PATTERN,
  );

  assert.deepEqual(offenders, []);
});

test("source modules read workflow defaults from config workflow defaults", () => {
  const offenders = findMatchingImports(filesUnder(
    SOURCE_ROOTS.bootstrap,
    SOURCE_ROOTS.features,
  ), WORKFLOW_DEFAULTS_FROM_ROOT_PATTERN);

  assert.deepEqual(offenders, []);
});

test("bootstrap external imports stay isolated in explicit leaf ports", () => {
  const offenders = walkFiles(BOOTSTRAP_ROOT)
    .filter((file) => BOOTSTRAP_EXTERNAL_IMPORT_PATTERN.test(readSource(file)))
    .map((file) => relative(BOOTSTRAP_ROOT, file))
    .filter((file) => !BOOTSTRAP_EXTERNAL_IMPORT_ALLOWLIST.has(file));

  assert.deepEqual(offenders, []);
});

test("bootstrap grouped port list covers grouped port files", () => {
  const groupedPortSet = new Set(BOOTSTRAP_GROUPED_PORT_FILES);
  const discovered = walkFiles(BOOTSTRAP_ROOT)
    .map((file) => relative(BOOTSTRAP_ROOT, file))
    .filter((file) => /(?:-ports|mount-ports|feature-controllers-port)\.(?:js|ts)$/.test(file))
    .filter((file) => !BOOTSTRAP_GROUPED_PORT_DISCOVERY_ALLOWLIST.has(file));
  const missing = discovered.filter((file) => !groupedPortSet.has(file));

  assert.deepEqual(missing, []);
});

test("runtime source paths avoid the legacy hidden credential facade", () => {
  const bootstrapFiles = walkFiles(BOOTSTRAP_ROOT);
  const desktopFiles = walkFiles(SOURCE_ROOTS.desktop);
  const featureFiles = walkFiles(FEATURE_ROOT).filter((filePath) => {
    return !filePath.endsWith("/features/credentials/hidden-inputs.js")
      && !filePath.endsWith("/features/credentials/hidden-inputs.ts");
  });
  for (const filePath of [...bootstrapFiles, ...desktopFiles, ...featureFiles]) {
    const source = readFileSync(filePath, "utf8");
    assert.equal(
      source.includes("features/credentials/hidden-inputs.js")
        || source.includes("../credentials/hidden-inputs.js")
        || source.includes("./hidden-inputs.js"),
      false,
      `${filePath} should not depend on hidden-inputs.js`,
    );
  }
});

test("job runtime default adapter shims are not kept in feature layer", () => {
  for (const fileName of ["job-actions-runtime-port.js", "presentation-runtime-port.js"]) {
    assert.equal(existsSync(resolveSourcePath(join(FEATURE_ROOT, "job-runtime", fileName))), false);
  }
});

test("recent jobs feature does not import home state directly", () => {
  for (const fileName of ["controller.js", "loader.js", "commit.js", "runtime-item.js"]) {
    // Allow `import type { HomeStatePort }`Compile-time erasure, no runtime dependency.
    const source = sourceWithoutTypeImports(readFeatureSource("recent-jobs", fileName));

    assert.equal(source.includes("../home/state.js"), false);
  }
  assert.equal(readFeatureSource("recent-jobs", "runtime-item.js").includes("../../job/core.js"), false);
  assert.equal(readFeatureSource("recent-jobs", "runtime-item.js").includes("../../job-status/"), false);
  assert.match(readFeatureSource("recent-jobs", "runtime-item.js"), /runtime-value-helpers\.js/);
  assert.equal(
    readFeatureSource("recent-jobs", "library-refresh-port.js").includes("../library/library-event-port.js"),
    false,
  );
  assert.equal(
    readFeatureSource("recent-jobs", "active-job-recovery.js").includes("../job-runtime/active-job-storage.js"),
    false,
  );
  assert.equal(readFeatureSource("recent-jobs", "state.js").includes("../../state/store.js"), false);
  assert.match(readFeatureSource("recent-jobs", "loading-state-contract.js"), /RECENT_JOBS_LOADING_STATES/);
});

test("current job state is store-only with no legacy mirror", () => {
  const currentJobStateSource = readJobRuntimeSource("current-job-state.js");
  const secondarySelectorSource = readJobRuntimeSource("current-job-secondary-selectors.js");

// Migration complete: Mirror port File must not exist. Selector read store snapshot
  assert.equal(existsSync(join(SOURCE_ROOTS.features, "job-runtime", "legacy-current-job-state-port.js")), false);
  assert.equal(/state\.currentJob[A-Za-z]*\s*=(?!=)/.test(currentJobStateSource), false);
// Allow TS Narrow: currentJobStoreFor(state as object | null | undefined).getSnapshot()
  assert.match(
    currentJobStateSource,
    /currentJobStoreFor\(\s*state(?:\s+as\s+[^)]+)?\s*\)\.getSnapshot\(\)/,
  );
  assert.equal(currentJobStateSource.includes("secondary-resource-cache.js"), false);
  assert.match(currentJobStateSource, /current-job-secondary-selectors\.js/);
  assert.match(secondarySelectorSource, /secondary-resource-cache\.js/);
});

test("job runtime library events use injected library ports", () => {
  const controllerSource = readJobRuntimeSource("controller.js");
  const libraryEventsSource = readJobRuntimeSource("library-events.js");

  assert.equal(controllerSource.includes("../library/library-event-port.js"), false);
  assert.equal(libraryEventsSource.includes("../library/library-event-port.js"), false);
  assert.equal(libraryEventsSource.includes("createLibraryEventPort"), false);
  assert.match(controllerSource, /libraryEventPort/);
  assert.match(libraryEventsSource, /contracts\/library-event-contract\.js/);
});

test("job-status layer does not keep ui compatibility facades", () => {
  const uiImports = findMatchingImports(filesUnder(SOURCE_ROOTS.jobStatus), /from\s+["']\.\.\/ui\//);

  assert.deepEqual(uiImports, []);
  assert.equal(existsSync(join(SOURCE_ROOTS.jobStatus, "job-stage-contract.js")), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.jobStatus, "job-stage-render-detection.js")), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.jobStatus, "job-status-card-renderer.js")), false);
  assert.equal(existsSync(join(SOURCE_ROOTS.jobStatus, "status-ring-fallback.js")), false);
});

test("ui layer does not keep stage action compatibility helper", () => {
  assert.equal(existsSync(join(SOURCE_ROOTS.ui, "stage-actions.js")), false);
});

test("status detail layer does not keep legacy render compatibility facades", () => {
  for (const fileName of ["renderer.js", "presentation.js"]) {
    assert.equal(existsSync(join(SOURCE_ROOTS.statusDetail, fileName)), false);
  }
});

test("credentials runtime state is store-only with no legacy mirror ports", () => {
// credential slice Unified to app-framework store, mirror port File must not reappear.
  for (const fileName of ["runtime-state-port.js", "balance-state-port.js", "legacy-runtime-port.js"]) {
    assert.equal(existsSync(join(SOURCE_ROOTS.features, "credentials", fileName)), false);
  }
  for (const fileName of ["validation.js", "deepseek-flow.js", "browser.js", "ocr-readiness-flow.js"]) {
    const source = readFeatureSource("credentials", fileName);
    assert.equal(source.includes("../../state/actions.js"), false);
    assert.equal(source.includes("legacy-runtime-port.js"), false);
    assert.equal(source.includes("balance-state-port.js"), false);
  }
});

test("upload controller reads upload state only through upload state port", () => {
  const source = readFeatureSource("upload", "controller.js");
  const stateSource = readFeatureSource("upload", "state.js");

  assert.equal(source.includes("../../state/actions.js"), false);
  assert.equal(source.includes("../../state/upload-state.js"), false);
  assert.match(source, /getUploadStatePort/);
  assert.equal(stateSource.includes("../../state/store.js"), false);
  assert.equal(stateSource.includes("../../state/upload-state.js"), false);
});

// ===== React Migration anti-regression gate(Phase 0 Effective from) =====
// New World (src/pages/**, src/shared/**) Consume legacy pure logic layer only
// (api/contracts/state-port/actions/view-model etc.), forbid import Legacy view layerâ
// Once referenced, old DOM view will "Rebound" into React tree, the migration will never be complete.
//
// Note: tests/esm-entry-resolution.test.mjs retired with Phase 2b reader cutoverâ
// Three pages (home/detail/reader) All entries pass through esbuild Build, import Broken link at build:js
// Build-time failure.,Standalone native no longer needed. ESM Guard parse fail. Fix: Validate input.

test("React New World Forbidden import Legacy view layer(Anti-Rebound)", () => {
  const REACT_ROOTS = [join(PROJECT_ROOT, "src/pages"), join(PROJECT_ROOT, "src/shared")];
  // Legacy view layer path signature:Hit violates
  const FORBIDDEN_IMPORT_PATTERNS = [
    // Block legacy only. src/js/components/;New World page own components/ Subdirectory
// (src/pages/*/components/, directory convention) Not in this column
[/from\s+["'][^"']*\/js\/components\//, "src/js/components/(Custom elements/Dialog view)"],
    [/from\s+["'][^"']*\/generated\//, "src/js/generated/(Precompiled artifacts.)"],
[/from\s+["'][^"']*\/bootstrap\//, "src/js/bootstrap/(Old DI assembly layer)"],
[/from\s+["'][^"']*\/features\/[^"']*\/view\.js["']/, "features/*/view.js (Old DOM view)"],
[/from\s+["'][^"']*\/features\/[^"']*view-port\.js["']/, "features/*view-port.js (Old DOM port)"],
[/from\s+["'][^"']*\/features\/[^"']*dom-contract\.js["']/, "features/*dom-contract.js (Old DOM contract)"],
    [/from\s+["'][^"']*\/features\/[^"']*card-markup\.js["']/, "features/*card-markup.js(String template)"],
[/from\s+["'][^"']*\/features\/[^"']*card-template\.js["']/, "features/*card-template.js (String template)"],
[/from\s+["'][^"']*\/js\/dom\//, "src/js/dom/(Old DOM tools)"],
  ];

  function walkReactFiles(root) {
    const pending = [root];
    const files = [];
    while (pending.length > 0) {
      const current = pending.pop();
      const stat = statSync(current);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(current)) {
          pending.push(join(current, entry));
        }
        continue;
      }
      if (isSourceFile(current)) {
        files.push(current);
      }
    }
    return files.sort();
  }

  const violations = [];
  for (const root of REACT_ROOTS) {
    if (!existsSync(root)) {
      continue;
    }
    for (const file of walkReactFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const [pattern, label] of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${relative(PROJECT_ROOT, file)} → ${label}`);
        }
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `React New world references old view layer.,Change to consuming the pure logic layer or at React Internal rewrite.:\n  ${violations.join("\n  ")}`,
  );
});


const HOME_FEATURES_ROOT = join(PROJECT_ROOT, "src/pages/home/features");
/** Any import whose module path reaches src/js (…/js/…); composition/external is the only gate. */
const HOME_FEATURES_DIRECT_JS_IMPORT =
  /from\s+["'][^"']*(?:^|\/)js\/[^"']+["']|from\s+["'][^"']*(?:\.\.\/)+js\/[^"']+["']/;

function pageHasDirectJsImport(source) {
  return source.split("\n").some((line) => {
    const code = line.split("//")[0];
    return (
      /\bfrom\s+["']/.test(code)
      && /js\//.test(code)
      && !/\/external(?:\.js)?["']/.test(code)
      && !/composition\/external/.test(code)
    );
  });
}

test("home features must not import src/js/* directly (use composition/external)", () => {
  const offenders = walkFiles(HOME_FEATURES_ROOT)
    .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file))
    .filter((file) => pageHasDirectJsImport(readSource(file)))
    .map((file) => relative(HOME_FEATURES_ROOT, file));

  assert.deepEqual(
    offenders,
    [],
    "import src/js/* only via pages/home/composition/external.ts",
  );
});

const DETAIL_PAGE_ROOT = join(PROJECT_ROOT, "src/pages/detail");

test("detail page must not import src/js/* directly (use pages/detail/external)", () => {
  const offenders = walkFiles(DETAIL_PAGE_ROOT)
    .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file))
    .filter((file) => {
      const base = relative(DETAIL_PAGE_ROOT, file).replace(/\\/g, "/");
      if (base === "external.ts") return false;
      return pageHasDirectJsImport(readSource(file));
    })
    .map((file) => relative(DETAIL_PAGE_ROOT, file).replace(/\\/g, "/"));

  assert.deepEqual(
    offenders,
    [],
    "import src/js/* only via pages/detail/external.ts",
  );
});

const READER_PAGE_ROOT = join(PROJECT_ROOT, "src/pages/reader");

test("reader non-legacy must not import src/js/* directly (use pages/reader/external)", () => {
  const offenders = walkFiles(READER_PAGE_ROOT)
    .filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file))
    .filter((file) => {
      const base = relative(READER_PAGE_ROOT, file).replace(/\\/g, "/");
      if (base === "external.ts") return false;
      if (base.startsWith("legacy/")) return false; // legacy Direct dependency js/reader
      return pageHasDirectJsImport(readSource(file));
    })
    .map((file) => relative(READER_PAGE_ROOT, file).replace(/\\/g, "/"));

  assert.deepEqual(
    offenders,
    [],
    "non-legacy reader code imports src/js/* only via pages/reader/external.ts",
  );
});
