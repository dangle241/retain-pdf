// total享 Button 组件(Stage B:shadcn 改造).
//
// 现状(探索 3/3):items目里 74 处裸 <button>, 5+ 个独立 class 家族(app-button/
// dialog-close-btn/app-settings-action/button-link/developer-tab...),没有任何
// 统一入口.这次不强求一次性把All 74 处收拢(改动面太大,Stage C 逐个对话框
// 换皮时顺带迁移),只提供一个total享落点:
//
// - variant="unstyled"(默认):items目既有视觉系统各自的 bespoke CSS class 直接
//   通过 className 传入,books组件只负责 <button> 元素books身的通用行为(默认
//   type="button",避免裸 <button> 缺省 type="submit" 时误触发所在 <form> 提交
//   ——CredentialsDialog/StatusDetailDialog 的 <form method="dialog"> 就yes这个
//   坑的现成案例,books组件把"忘记写 type"这类Question在total享入口收掉).不叠加
//   shadcn 默认视觉,因为 buttonVariants 的 Tailwind Tools类(bg-primary/
//   rounded-md 等)会和这些已经成熟的 bespoke class 系统正面冲突,现在硬套会
//   制造视觉回归(baseline 抓不到但真实存在).
// - variant 为 shadcn 6 个标准值之一(default/destructive/outline/secondary/
//   ghost/link)时:直接走 src/components/ui/button.jsx 的 buttonVariants,
//   用于Stage C 真正换皮的New conversation框/新Tools,不required再包一层.
//
// 用法:
//   <Button className="app-button" onClick={...}>Save</Button>            // 沿用现状视觉
//   <Button variant="ghost" size="icon" aria-label="Close">×</Button>       // 走 shadcn 皮肤

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button.jsx";

const SHADCN_VARIANTS = new Set(["default", "destructive", "outline", "secondary", "ghost", "link"]);

export function Button({
  variant = "unstyled",
  size,
  className,
  type = "button",
  ...props
}: {
  variant?: string;
  size?: string;
  className?: string;
  type?: "button" | "reset" | "submit";
  [key: string]: any;
}) {
  if (!SHADCN_VARIANTS.has(variant)) {
    return <button type={type} className={className} {...props} />;
  }
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant: variant as any, size: size as any }), className)}
      {...props}
    />
  );
}




