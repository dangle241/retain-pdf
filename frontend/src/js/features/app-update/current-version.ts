// 3b app-update React 化(蓝图 §5)唯一的 APP_VERSION 出口。
//
// 直接 re-export generated/app-version.js 的 APP_VERSION——
// architecture-boundaries 门禁禁止 src/pages/**、src/shared/** 直接 import
// src/js/generated/**(预编译/生成产物)。这个薄 re-export 文件本身仍在旧
// 世界(src/js/features/app-update/),不受该门禁约束;新世界从这里间接拿到
// 版本号,不复制字面量、不违反门禁,版本号更新脚本(generate-app-version.mjs)
// 改一处两边同时生效。

export { APP_VERSION } from "../../generated/app-version.js";
