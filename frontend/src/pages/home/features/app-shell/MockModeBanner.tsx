import {
  isMockMode,
  mockScenario,
} from "../../composition/external.js";

// Mock Demo mode banner: display in parallel when URL contains ?mock=demo.
// Prompt user to open library book â Translation Tab â Translate entire book. Review live progress animation.

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
Not connected to real backend. Open ãCollectionãLogo Book â ãTranslationãTab â ãtranslate the entire bookã,
See approximation in details. 16s fake progress (OCR â Translation â Rendering â Done.)
      </span>
    </div>
  );
}
