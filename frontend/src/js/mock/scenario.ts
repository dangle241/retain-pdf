export function currentMockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  const aliases: Record<string, string> = {
    queued: "upload",
    running: "translate",
    succeeded: "done",
    complete: "done",
    completed: "done",
    // demo: recommended local-demo entry; static list uses parallel, translation submit walks a live job.
    demo: "parallel",
    live: "parallel",
  };
  const normalized = aliases[value] || value;
  return ["upload", "ocr", "translate", "render", "done", "failed", "parallel"].includes(normalized) ? normalized : "";
}

export function isoOffsetMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}


