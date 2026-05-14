import { Card as RadixCard } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";
import { RadixThemePilot } from "@/components/ui/radix-theme";
import { cn } from "@/lib/utils";

function DataCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <RadixThemePilot className="contents" surface="data-card">
      <RadixCard
        className={cn(
          "flex flex-col gap-6 overflow-hidden rounded-xl border border-border/50 bg-card py-6 text-card-foreground",
          className,
        )}
        data-slot="data-card"
        size="3"
        variant="surface"
        {...props}
      />
    </RadixThemePilot>
  );
}

function DataCardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("grid auto-rows-min gap-1.5 px-6", className)}
      data-slot="data-card-header"
      {...props}
    />
  );
}

function DataCardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("leading-none font-semibold", className)}
      data-slot="data-card-title"
      {...props}
    />
  );
}

function DataCardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="data-card-description"
      {...props}
    />
  );
}

function DataCardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("px-6", className)}
      data-slot="data-card-content"
      {...props}
    />
  );
}

export {
  DataCard,
  DataCardHeader,
  DataCardTitle,
  DataCardDescription,
  DataCardContent,
};
