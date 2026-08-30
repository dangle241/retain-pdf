// Thành phần Button dùng chung (giai đoạn B: chuyển đổi shadcn).
//
// Hiện trạng (khảo sát 3/3): dự án có 74 <button> thô và hơn 5 họ class độc lập (app-button/
// dialog-close-btn/app-settings-action/button-link/developer-tab...), không có
// entry thống nhất. Lần này không ép gom cả 74 chỗ cùng lúc vì phạm vi thay đổi quá lớn; ở giai đoạn C, từng hộp thoại sẽ
// được di chuyển khi đổi giao diện; hiện chỉ cung cấp một điểm dùng chung:
//
// - variant="unstyled" (mặc định): các class CSS riêng của hệ thống hình ảnh hiện có được
//   truyền trực tiếp qua className; thành phần này chỉ phụ trách hành vi chung của chính phần tử <button> (mặc định
//   type="button", tránh <button> thô mặc định thành type="submit" và vô tình gửi <form> chứa nó
//   ; <form method="dialog"> trong CredentialsDialog/StatusDetailDialog là một
//   ví dụ thực tế; thành phần này xử lý lỗi kiểu "quên đặt type" tại entry dùng chung). Không chồng thêm
//   giao diện mặc định của shadcn vì các utility Tailwind trong buttonVariants (bg-primary/
//   rounded-md, v.v.) sẽ xung đột trực tiếp với các hệ class riêng đã ổn định; áp dụng cứng lúc này sẽ
//   gây hồi quy hình ảnh thực tế mà đường cơ sở không bắt được.
// - Khi variant là một trong sáu giá trị chuẩn của shadcn (default/destructive/outline/secondary/
//   ghost/link): dùng trực tiếp buttonVariants trong src/components/ui/button.jsx,
//   dành cho hộp thoại/tính năng mới thực sự đổi giao diện ở giai đoạn C, không cần bọc thêm một lớp.
//
// Cách dùng:
//   <Button className="app-button" onClick={...}>Lưu</Button>            // Giữ giao diện hiện tại
//   <Button variant="ghost" size="icon" aria-label="Đóng">×</Button>       // Dùng giao diện shadcn

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
