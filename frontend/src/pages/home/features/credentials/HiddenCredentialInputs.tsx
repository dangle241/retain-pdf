// Bốn input xác thực ẩn (điểm đấu nối cốt lõi của rủi ro 1 trong bản thiết kế); HeroUpload/WorkflowPanel 3a
// đọc .value của các nút DOM này để gửi tác vụ; miền 3b chịu trách nhiệm đồng bộ chúng hai chiều với
// singleton default-state-port.js.
//
// Chỉ kết xuất tại đây; WorkflowPanel.jsx đã thay bốn input giữ chỗ tĩnh bằng
// thành phần này với chú thích "input xác thực ẩn được miền credentials 3b tiếp quản phản chiếu"; toàn codebase
// chỉ cho phép một bản vì kết xuất lặp sẽ tạo DOM id trùng.
//
// Có kiểm soát, khác kế hoạch ban đầu "ref không kiểm soát gắn mirrorCredentialsToHiddenInputs";
// đây là điều chỉnh triển khai có chủ ý vì lý do dưới đây: đăng ký trực tiếp credentialsStatePort.store để kết xuất
// value. Kiểm thử thực tế với jsdom + host diff React 18/19 xác nhận rằng
// khi <input defaultValue> do React kết xuất bị mã ngoài thay đổi qua mirrorCredentialsToHiddenInputs bằng
// `node.value = x` trực tiếp, chỉ cần *bất kỳ* thành phần anh em nào trong cây con kết xuất lại và commit
// (HeroUpload commit gần mỗi giây trong lúc tải lên), logic thu hồi trạng thái
// của phần tử biểu mẫu React sẽ âm thầm kéo .value về defaultValue(""), tương đương xóa
// token vừa lưu; đây không phải giả tượng test mà cũng tái hiện ở production khi token biến mất giữa lúc tải lên.
// Cho credentialsStatePort điều khiển trực tiếp value= để loại bỏ tận gốc loại lỗi này:
// store là nguồn sự thật duy nhất, DOM chỉ là projection; không còn cạnh tranh "ghi ngoài trực tiếp với thu hồi React".
// Tác dụng phụ mirrorToDom (mirrorCredentialsToHiddenInputs) của default-state-port.js
// vẫn chạy bình thường qua các lệnh gọi trong browser.js; giờ chỉ thừa nhưng vô hại, còn luồng ghi thật sự
// có hiệu lực là đăng ký store tại đây.

import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { hidden: HIDDEN_IDS } = CREDENTIAL_DOM_IDS;

function selectCredentials(snapshot) {
  return snapshot.credentials;
}

export function HiddenCredentialInputs() {
  const services = useHomeServices();
  const credentials = useStoreSnapshot(services.ports.credentialsStatePort.store, selectCredentials);

  return (
    <>
      <input id={HIDDEN_IDS.ocrProvider} name="ocr_provider" type="hidden" value={credentials.ocrProvider || "paddle"} readOnly />
      <input id={HIDDEN_IDS.paddleToken} name="paddle_token" type="hidden" value={credentials.paddleToken || ""} readOnly />
      <input id={HIDDEN_IDS.modelApiKey} name="api_key" type="hidden" value={credentials.modelApiKey || ""} readOnly />
    </>
  );
}
