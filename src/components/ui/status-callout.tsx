import { Callout } from "@radix-ui/themes";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type StatusCalloutTone = "info" | "success" | "warning" | "error";

const TONE_CLASS_NAMES = {
  info: "border-[var(--info-border)] bg-[var(--info-muted)] text-[var(--info-foreground)]",
  success:
    "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-foreground)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-foreground)]",
  error:
    "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error-foreground)]",
} satisfies Record<StatusCalloutTone, string>;

export interface StatusCalloutProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "color" | "title"
> {
  children: ReactNode;
  live?: boolean;
  title?: ReactNode;
  tone?: StatusCalloutTone;
}

const StatusCallout = forwardRef<HTMLDivElement, StatusCalloutProps>(
  (
    {
      children,
      className,
      live = true,
      role,
      "aria-live": ariaLive,
      title,
      tone = "info",
      ...props
    },
    ref,
  ) => {
    const defaultRole = tone === "error" ? "alert" : "status";
    const defaultAriaLive = tone === "error" ? "assertive" : "polite";

    return (
      <Callout.Root
        ref={ref}
        className={cn(
          "rounded-lg border p-4 text-sm",
          TONE_CLASS_NAMES[tone],
          className,
        )}
        data-slot="status-callout"
        role={live ? (role ?? defaultRole) : role}
        aria-live={live ? (ariaLive ?? defaultAriaLive) : ariaLive}
        {...props}
        data-ui-pilot="radix-themes-status-callout"
      >
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </Callout.Root>
    );
  },
);

StatusCallout.displayName = "StatusCallout";

export { StatusCallout };
