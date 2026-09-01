// home 页仍使用的自定义元素标签(legacy islands / 占位契约)。
// 部分标签仍写 class= 而非 className，故在 HTMLAttributes 上补充 class。

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
