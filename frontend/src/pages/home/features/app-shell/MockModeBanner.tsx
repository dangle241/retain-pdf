import {
  isMockMode,
  mockScenario,
} from "../../composition/external.js";

// Mock 演示模式提示entries: URL 带 ?mock=demo / parallel 等时Display.
// 引导用户打开Library书 → Translation Tab → Translation整books, 看 live Progress动画.

export function MockModeBanner() {
  if (!isMockMode()) {
    return null;
  }
  const scenario = mockScenario() || "demo";
  return (
    <div
      id="mock-mode-banner"
      className="mock-mode-banner"
      role="status"
      data-mock-scenario={scenario}
    >
      <strong>Mock Demo Mode</strong>
      <span>
        Current <code>?mock={scenario}</code>
        : No real backend connection. Open a book from the Library → Translation tab → Translate entire book, 
        and watch the ~16 s simulated progress (OCR → Translation → Rendering → Done).
      </span>
    </div>
  );
}




