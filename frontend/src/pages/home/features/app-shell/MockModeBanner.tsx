import {
  isMockMode,
  mockScenario,
} from "../../composition/external.js";

// Mock demo mode tip entry: displayed when URL has ?mock=demo / parallel etc. Guides user
// to open a library book → Translation tab → translate entire book, watch live progress animation.

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




