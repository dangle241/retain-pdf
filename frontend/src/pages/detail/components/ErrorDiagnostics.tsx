// Failed调试上下文卡片.#detail-failure-debug-context yes"命令式孤岛":
// 内容由保留的旧模块 src/js/job-detail/failure.js(经 overview-renderer.js)
// 在Data加载后以 innerHTML 写入.React 侧用 memo 固定为叶子容器, 
// 不Rendering动态子节点,重Rendering时不会触碰命令式写入的内容.

import { memo } from "react";

export const ErrorDiagnostics = memo(function ErrorDiagnostics() {
  return (
    <article className="detail-card detail-card-wide">
      <h2>Failed调试上下文</h2>
      <div id="detail-failure-debug-context" className="detail-debug-context">
        <div className="detail-empty">No 结构化Failed上下文</div>
      </div>
    </article>
  );
});




