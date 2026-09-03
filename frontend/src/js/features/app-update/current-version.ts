// Sole APP_VERSION export for 3b app-update React migration (Blueprint §5).
//
// Directly re-exports APP_VERSION from generated/app-version.js.
// Architecture boundary guards disallow src/pages/**, src/shared/** from importing
// src/js/generated/** directly. This thin re-export file lives in the legacy realm
// (src/js/features/app-update/) and is exempt; new code imports version here indirectly
// without duplicating literals or violating boundaries. generate-app-version.mjs updates both.

export { APP_VERSION } from "../../generated/app-version.js";



