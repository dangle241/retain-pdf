import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner";

// Dự án không dùng Next.js, không có gói next-themes và tokens.css hiện chỉ có một :root
// (không có chế độ tối). Cách triển khai mặc định của shadcn dùng useTheme() từ next-themes để đọc theme hiện tại;
// ở đây bỏ lớp gián tiếp này và cố định giá trị "light"; hành vi tương đương mà không thêm phụ thuộc thừa.
const Toaster = ({
  ...props
}) => {
  const theme = "light"

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        } as React.CSSProperties
      }
      {...props} />
  );
}

export { Toaster }
