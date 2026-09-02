// Workflow panel (translation workflow card, side-by-side partials/main-content.html
// .translation-workflow-card block mirrored by id).
//
// - #job-warning: workflow view store (written by updateJobWarning bridge callback)
// - #job-form: workflow submission belongs to app-actions domain (3b), onSubmit goes through bridge.submitForm
//   (3a is preventDefault placeholder; hidden credential inputs are taken over by credentials domain
//   HiddenCredentialInputs, rendered only once, no duplicate DOM ids)
// - Upload tile/action group/inline error box are placed by upload domain components and InlineErrorBox

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
        A previous task is still processing. Please wait for the current task to finish before submitting a new PDF.
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




