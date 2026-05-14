import { Callout } from "@radix-ui/themes";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { RadixThemePilot } from "@/components/ui/radix-theme";

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
  title?: ReactNode;
  tone?: StatusCalloutTone;
}

const StatusCallout = forwardRef<HTMLDivElement, StatusCalloutProps>(
  (
    {
      children,
      className,
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
      <RadixThemePilot className="contents" surface="status-callout">
        <Callout.Root
          ref={ref}
          className={cn(
            "rounded-lg border p-4 text-sm",
            TONE_CLASS_NAMES[tone],
            className,
          )}
          data-slot="status-callout"
          role={role ?? defaultRole}
          aria-live={ariaLive ?? defaultAriaLive}
          {...props}
        >
          {title ? <p className="font-medium">{title}</p> : null}
          <div className={title ? "mt-1" : undefined}>{children}</div>
        </Callout.Root>
      </RadixThemePilot>
    );
  },
);

StatusCallout.displayName = "StatusCallout";

export { StatusCallout };
