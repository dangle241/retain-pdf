// Các thẻ phần tử tùy chỉnh vẫn dùng trên trang home (đảo legacy / hợp đồng giữ chỗ).
// Một số thẻ vẫn dùng class= thay vì className nên bổ sung class vào HTMLAttributes.

import type { HTMLAttributes, ReactNode } from "react";

/** Shared props for home-page placeholder custom elements. */
type HomeCustomElementProps = HTMLAttributes<HTMLElement> & {
  /** Legacy HTML class attribute still used by some home tags. */
  class?: string;
  children?: ReactNode;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "inline-error-box": HomeCustomElementProps;
      "library-search-island": HomeCustomElementProps;
      "recent-jobs-dialog": HomeCustomElementProps;
      "developer-auth-dialog": HomeCustomElementProps;
      "developer-settings-dialog": HomeCustomElementProps;
      "page-range-dialog": HomeCustomElementProps;
      "app-shell-header": HomeCustomElementProps;
    }
  }
}

export {};
