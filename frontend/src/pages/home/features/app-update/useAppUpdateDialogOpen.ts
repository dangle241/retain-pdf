// AppUpdateBanner details dialog toggle state. Implement: `isOpen = !isOpen`. ââ pure UI transient (General Plan "State Strategy" item 5
// item: status absent store items in, rewrite still not entering store) local useState is sufficient, no
// need dialog-store.js cross-subtree sharing mechanism: button and dialog now merged into the same
// AppUpdateBanner.jsx (Blueprint Â§5), no "cross-subtree" open/close scenario exists.

import { useState, type Dispatch, type SetStateAction } from "react";

export function useAppUpdateDialogOpen(
  initialOpen = false,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initialOpen);
  return [open, setOpen];
}
