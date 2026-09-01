// Shared Button component (phase B: shadcn refactor).
//
// Currently (Explore 3/3): in the project there are 74 raw s, 5+ independent class families (app-button/
// dialog-close-btn/app-settings-action/button-link/developer-tab...),None
// Unified entry. No need to complete all at once. 74 is too large; phase C will do dialog by dialog
// Migrate during rebranding.),Provide single shared drop target.:
//
// - variant="unstyled" (default): directly uses the project's existing visual system's respective bespoke CSS class
//   through className, component only handles  general element behavior (default
//   type="button", avoiding bare  default type="submit" falsely triggering  submission
//   — for CredentialsDialog/StatusDetailDialog's , that's it
//   Ready-made pitfall examples,This component"Forgot to write type"Shared entry absorbs this class of issues.)Do not stack.
//   shadcn default visual, because buttonVariants' Tailwind classes (bg-primary/
//   rounded-md etc.) integrate with these mature bespoke class systems head-on, causing collision; hardcoding now
//   Generate visual regression(baseline Elusive but real)。
// - when variant is one of shadcn's 6 standard values (default/destructive/outline/secondary/
//   ghost/link): directly goes through src/components/ui/button.jsx's buttonVariants,
//   For stage C Truly reskinned new dialog/New feature,No wrapper needed.
//
// Usage:
//   <Button className="app-button" onClick={...}>Save</Button>            // Keep the current visual
//   ×       // uses shadcn skin

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
