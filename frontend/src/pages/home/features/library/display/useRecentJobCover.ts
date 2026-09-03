// Card cover image loading hook (blueprint §2 features/library/, risk mitigation §8.3).
//
// Reuses: image-loader.js facade's loadFirstRecentJobImage (module-level objectURL
// cache, never revoke——React unmount **must not** revoke; invalidation only via
// invalidateRecentJobImages; this hook doesn't touch cache lifecycle at all); card-presenter.js
// facade's recentJobRawImageUrls to get candidate URL list.
//
// imageCacheVersionOf copied from recent-job-card.js:12-29 (facade doesn't export this pure
// function; per blueprint we copied directly rather than adding a new export surface). Token for
// race condition prevention: increment token when job switches or candidate URLs change; on
// out-of-order resolve, verify token is still the latest before writing state, preventing
// old request images from overwriting new ones during fast card reuse.

import { useEffect, useRef, useState } from "react";
import type { LibraryCardItem } from "../types.js";
import {
  loadFirstRecentJobImage,
  recentJobRawImageUrls,
} from "../../../composition/external.js";

// Cached version only changes when "cover may have actually changed". Cover is rendered by backend /jobs/{id}/cover
// (in-progress = source PDF first pages; may switch to finished cover only after task is done), so cover
// content doesn't change during execution. Original implementation included updated_at + progress.current/percent
// fields that "change on every poll" in the cache version key → cache miss every poll → refetch cover blob,
// generate new objectURL, <img> src swap causes flicker (also leaks one objectURL per poll). This is exactly
// the "Library card flickering during execution" users see.
//
// Fix: non-terminal states only count status for cache version (queued/running constant, cover fetched once is
// enough; no refetch every poll); only at terminal state (succeeded/failed/canceled) do we include updated_at
// — at that point the cover may have just been produced/updated, need one bust; updated_at can also distinguish
// different runs (rerun has new done timestamp, cover refreshes accordingly), preserving the original "cover
// changes after rerun" capability.
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
    // rawUrlsKey/cacheVersion are the primitive forms of rawUrls/cacheVersion, used as
    // effect dependencies (arrays/objects get new reference each render, can't go directly into deps table).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrlsKey, cacheVersion]);

  return coverUrl;
}




