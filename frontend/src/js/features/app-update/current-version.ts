// 3b chuyển app-update sang React (bản thiết kế §5): entry APP_VERSION duy nhất.
//
// Re-export trực tiếp APP_VERSION từ generated/app-version.js;
// cổng architecture-boundaries cấm src/pages/** và src/shared/** import trực tiếp
// src/js/generated/** (đầu ra biên dịch trước/được tạo). Bản thân tệp re-export mỏng này vẫn nằm trong
// phần cũ (src/js/features/app-update/) nên không bị cổng này ràng buộc; phần mới lấy gián tiếp
// số phiên bản từ đây, không sao chép literal và không vi phạm cổng; script cập nhật phiên bản (generate-app-version.mjs)
// chỉ cần sửa một chỗ để cả hai phía cùng có hiệu lực.

export { APP_VERSION } from "../../generated/app-version.js";
