// Workflow panel(Translate workflow card, refer to partials/main-content.html
// .translation-workflow-card block mirrored by id).
//
// - #job-warning: workflow view store(updateJobWarning Bridge callback write)
// - #job-form: Submit process belongs to app-actions domain(3b), onSubmit uses bridge.submitForm
//   (3a is preventDefault placeholder; hidden credential input is handled by credentials domain
//   HiddenCredentialInputs Take over,Render single instance.,Avoid reinventing the wheel. DOM id)
// - Upload tiles/Action group/Inline error boxes are composed of upload Domain component and InlineErrorBox Placement

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { HeroUpload } from "../upload/HeroUpload.jsx";
import { InlineErrorBox } from "../../components/InlineErrorBox.jsx";
import { HiddenCredentialInputs } from "../credentials/HiddenCredentialInputs.jsx";

export function WorkflowPanel() {
  const services = useHomeServices();
  const workflow = useStoreSnapshot(services.stores.workflowView);

  return (
    <section className="translation-workflow-card">
      <div id="job-warning" className={`job-warning${workflow.jobWarningVisible ? "" : " hidden"}`}>
        Previous task still processing. Wait for completion before submitting new. PDF。
      </div>

      <form
        id="job-form"
        className="form"
        noValidate
        onSubmit={(event) => services.bridge.submitForm(event)}
      >
        <HiddenCredentialInputs />

        <HeroUpload />
        <InlineErrorBox />
      </form>
    </section>
  );
}
