// AppUpdateBanner detail dialog open/close state — pure UI transient (master plan
// "Status strategy" Page 5 entries: things not in the store currently, and won't be after
// rewrite). Plain useState suffices, no need for dialog-store.js cross-subtree sharing
// mechanism: button and dialog are now merged into the same AppUpdateBanner.jsx
// (blueprint §5), no "cross-subtree" open/close scenario exists.

import { useState, type Dispatch, type SetStateAction } from "react";

export function useAppUpdateDialogOpen(
  initialOpen = false,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initialOpen);
  return [open, setOpen];
}




