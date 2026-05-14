import { Badge as RadixBadge } from "@radix-ui/themes";
import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent",
        secondary: "border-transparent",
        destructive:
          "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error-foreground)]",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends
    Omit<
      HTMLAttributes<HTMLSpanElement>,
      "color" | "defaultChecked" | "defaultValue"
    >,
    VariantProps<typeof badgeVariants> {
  autoComplete?: string;
  disabled?: boolean;
  form?: string;
  name?: string;
  value?: string;
}

const RADIX_BADGE_VARIANT = {
  default: "solid",
  secondary: "soft",
  destructive: "surface",
  outline: "outline",
} as const;

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <RadixThemePilot className="contents" surface="badge">
        <RadixBadge
          ref={ref}
          className={cn(badgeVariants({ variant }), className)}
          data-slot="badge"
          radius="full"
          variant={RADIX_BADGE_VARIANT[variant ?? "default"]}
          {...props}
        />
      </RadixThemePilot>
    );
  },
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
