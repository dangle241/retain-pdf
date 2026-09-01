// 3b app-update React-ize (blueprint §5) unique APP_VERSION exit.
//
// Directly re-export APP_VERSION from generated/app-version.js —
// architecture-boundaries gate forbids direct import from src/pages/** or src/shared/**
// src/js/generated/**(Precompiled/Build artifacts)Thin re-export File still old.
// The world (src/js/features/app-update/) is exempt from access control; NewWorld retrieves indirectly from here.
// Version number, no literal copy, no gate violation; version bump script (generate-app-version.mjs)
// Change once, apply both sides.

export { APP_VERSION } from "../../generated/app-version.js";
