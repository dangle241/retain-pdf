// 把需鉴权 / mock:// 的 PDF URL 拉成 react-pdf 可用的 { data: Uint8Array }。
// 会话层会先整文件下载完成再展示；本 hook 也可独立使用。

import { useEffect, useState } from "react";
import { fetchProtected } from "../external.js";

export type ProtectedPdfFile = { data: Uint8Array };

export type ProtectedPdfState = {
  file: ProtectedPdfFile | null;
  loading: boolean;
  error: string;
};

const fileCache = new Map<string, ProtectedPdfFile>();

export function getCachedProtectedPdf(url: string): ProtectedPdfFile | null {
  const key = `${url || ""}`.trim();
  return key ? fileCache.get(key) || null : null;
}

export function setCachedProtectedPdf(url: string, file: ProtectedPdfFile) {
  const key = `${url || ""}`.trim();
  if (key) {
    fileCache.set(key, file);
  }
}

export async function loadProtectedPdfFile(
  url: string,
  fetchResource: typeof fetchProtected = fetchProtected,
): Promise<ProtectedPdfFile | null> {
  const normalized = `${url || ""}`.trim();
  if (!normalized) {
    return null;
  }
  const cached = fileCache.get(normalized);
  if (cached) {
    return cached;
  }
  const response = await fetchResource(normalized);
  if (!response.ok) {
    const err = new Error(`读取 PDF 失败 (${response.status})`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  const buffer = await response.arrayBuffer();
  const file = { data: new Uint8Array(buffer) };
  fileCache.set(normalized, file);
  return file;
}

/** 并行下载多份 PDF，全部完成才 resolve；onItem 用于进度文案 */
export async function loadProtectedPdfFiles(
  urls: string[],
  {
    fetchResource = fetchProtected,
    onItem,
  }: {
    fetchResource?: typeof fetchProtected;
    onItem?: (info: { index: number; total: number; url: string }) => void;
  } = {},
): Promise<(ProtectedPdfFile | null)[]> {
  const list = urls.map((u) => `${u || ""}`.trim());
  const total = list.filter(Boolean).length || 1;
  let done = 0;
  return Promise.all(
    list.map(async (url, index) => {
      if (!url) {
        return null;
      }
      onItem?.({ index, total, url });
      const file = await loadProtectedPdfFile(url, fetchResource);
      done += 1;
      onItem?.({ index: done - 1, total, url });
      return file;
    }),
  );
}

export function useProtectedPdfFile(
  url = "",
  /** 会话已预下载时直接注入，跳过二次请求 */
  preloaded: ProtectedPdfFile | null = null,
): ProtectedPdfState {
  const [file, setFile] = useState<ProtectedPdfFile | null>(
    () => preloaded || getCachedProtectedPdf(url),
  );
  const [loading, setLoading] = useState(
    () => Boolean(`${url || ""}`.trim()) && !preloaded && !getCachedProtectedPdf(url),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (preloaded) {
      setFile(preloaded);
      setLoading(false);
      setError("");
      return;
    }
    const normalized = `${url || ""}`.trim();
    if (!normalized) {
      setFile(null);
      setLoading(false);
      setError("");
      return;
    }
    const cached = getCachedProtectedPdf(normalized);
    if (cached) {
      setFile(cached);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setFile(null);

    loadProtectedPdfFile(normalized)
      .then((next) => {
        if (!cancelled) {
          setFile(next);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFile(null);
          setLoading(false);
          setError(err?.message || String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, preloaded]);

  return { file, loading, error };
}
