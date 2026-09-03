// Shared Button component (Stage B: shadcn migration).
//
// Background: 74 bare <button> elements across 5+ independent class families
// (app-button / dialog-close-btn / app-settings-action / button-link / developer-tab...).
// This component provides a single shared landing point without forcing an all-at-once migration:
//
// - variant="unstyled" (default): callers pass bespoke CSS classes directly via className.
//   The component handles standard <button> behavior (default type="button" to avoid accidental
//   form submissions when omitted inside <form method="dialog">). Does not layer shadcn default
//   visuals to prevent collisions with existing mature CSS.
// - variant matches one of 6 shadcn standards (default/destructive/outline/secondary/ghost/link):
//   delegates directly to buttonVariants from src/components/ui/button.jsx.
//
// Usage:
//   <Button className="app-button" onClick={...}>Save</Button>            // Existing bespoke style
//   <Button variant="ghost" size="icon" aria-label="Close">×</Button>       // shadcn variant

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




