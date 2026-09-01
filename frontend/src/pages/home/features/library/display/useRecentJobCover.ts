// Load card cover image. hook (Blueprint Â§2 features/library/, Risk mitigation Â§8.3).
//
// Reuse: image-loader.js facade's loadFirstRecentJobImage (module-level objectURL
// Cache, never revoke ââ React unmount must NOT revoke, invalidation only
// invalidateRecentJobImages,No cache lifecycle handling here.);card-presenter.js
// facade's recentJobRawImageUrls gets candidate URL list.
//
// imageCacheVersionOf copied from recent-job-card.js:12-29 (facade pure function not exported.
// Function, copy per blueprint spec; skip new export interface). token prevents race: job switch or candidate URL
// Increment on change. token, async resolve verify on return token write only if latest. state, prevent
// Old request images overwrite new ones during rapid card reuse.

import { useEffect, useRef, useState } from "react";
import type { LibraryCardItem } from "../types.js";
import {
  loadFirstRecentJobImage,
  recentJobRawImageUrls,
} from "../../../composition/external.js";

// Cache version only if "Cover likely changed." Cover changes only then. Served by backend /jobs/{id}/cover rendering
// (Running = original PDF Home, switch to final cover only after task completion). Cover during execution
// Content unchanged. Original impl puts updated_at + progress.current/percent etc. "Polls every beat.
// "Changed" field counts toward cache version. â Cache hit every second. miss â re-fetch cover blob,
// Generate new objectURL, <img> src change causes flicker (leaks one objectURL per tick). This
// Exactly what the user sees"Library card flickers during runtime."。
//
// fix:non-terminal states only by status version counting" or "count version(queued/running Period Constant,Pull cover once.,No more
// Retake every shot); for final state (succeeded/failed/canceled) only updated_at is counted ââ at this time
// Cover may have just been generated. /Update requires one bust; updated_at distinguishes different runs (Reruns will have
// New completion timestamp,Cover refreshes accordingly),Preserve original."Rerun with new cover."capabilities.
const TERMINAL_COVER_STATUSES = new Set(["succeeded", "failed", "canceled", "cancelled"]);

function imageCacheVersionOf(item: LibraryCardItem = {}) {
  const status = `${item.status || ""}`.trim();
  if (TERMINAL_COVER_STATUSES.has(status)) {
    return `${status}|${item.updated_at ?? ""}`;
  }
  return status;
}

export function useRecentJobCover(item?: LibraryCardItem | null) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const tokenRef = useRef(0);
  const safeItem = item || {};

  const rawUrls = recentJobRawImageUrls(safeItem);
  const cacheVersion = imageCacheVersionOf(safeItem);
  const rawUrlsKey = rawUrls.join("|");

  useEffect(() => {
    const token = (tokenRef.current += 1);
    if (rawUrls.length === 0) {
      setCoverUrl(null);
      return undefined;
    }
    let cancelled = false;
    loadFirstRecentJobImage(rawUrls, { cacheVersion })
      .then((url) => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(url || null);
      })
      .catch(() => {
        if (cancelled || tokenRef.current !== token) {
          return;
        }
        setCoverUrl(null);
      });
    return () => {
      cancelled = true;
    };
// rawUrlsKey/cacheVersion are primitive versions of rawUrls/cacheVersion, use as
// effect dependency (Array/Object creates new reference on every render, cannot add directly to dependency table).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlsKey, cacheVersion]);

  return coverUrl;
}
