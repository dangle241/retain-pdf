// Panel workflow (thẻ workflow dịch, đối chiếu
// khối .translation-workflow-card trong partials/main-content.html và phản chiếu từng ID).
//
// - #job-warning: workflow view store (callback cầu nối updateJobWarning ghi vào).
// - #job-form: luồng gửi thuộc miền app-actions (3b), onSubmit dùng bridge.submitForm
//   (3a là placeholder preventDefault; input thông tin xác thực ẩn do
//   HiddenCredentialInputs của miền credentials tiếp quản, chỉ render một bản, không tạo trùng ID DOM).
// - Ô tải lên/nhóm hành động/hộp lỗi nội tuyến lần lượt do component miền upload và InlineErrorBox triển khai.

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
        Phát hiện tác vụ trước vẫn đang xử lý. Nên chờ tác vụ hiện tại kết thúc trước khi gửi PDF mới.
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
