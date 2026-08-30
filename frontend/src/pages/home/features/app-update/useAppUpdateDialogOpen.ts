// Trạng thái đóng/mở dialog chi tiết AppUpdateBanner là UI tạm thuần (mục 5 "Chiến lược trạng thái"
// của kế hoạch: thứ hiện không nằm trong store thì sau viết lại cũng không vào store). useState cục bộ là đủ, không
// cần cơ chế chia sẻ qua cây con của dialog-store.js; nút và dialog đã hợp nhất trong cùng
// AppUpdateBanner.jsx (bản thiết kế §5), không có tình huống đóng/mở qua cây con.

import { useState, type Dispatch, type SetStateAction } from "react";

export function useAppUpdateDialogOpen(
  initialOpen = false,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initialOpen);
  return [open, setOpen];
}
