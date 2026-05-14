import { Card as RadixCard } from "@radix-ui/themes";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type DataCardProps = Omit<ComponentPropsWithoutRef<"div">, "color">;

const DataCard = forwardRef<HTMLDivElement, DataCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <RadixCard
        ref={ref}
        {...props}
        className={cn(
          "flex flex-col gap-6 overflow-hidden rounded-xl border border-border/50 bg-card py-6 text-card-foreground",
          className,
        )}
        data-slot="data-card"
        data-ui-pilot="radix-themes-data-card"
        size="3"
        variant="surface"
      />
    );
  },
);

DataCard.displayName = "DataCard";

const DataCardHeader = forwardRef<HTMLDivElement, DataCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("grid auto-rows-min gap-1.5 px-6", className)}
        data-slot="data-card-header"
      />
    );
  },
);

DataCardHeader.displayName = "DataCardHeader";

const DataCardTitle = forwardRef<HTMLDivElement, DataCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("leading-none font-semibold", className)}
        data-slot="data-card-title"
      />
    );
  },
);

DataCardTitle.displayName = "DataCardTitle";

const DataCardDescription = forwardRef<HTMLDivElement, DataCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("text-sm text-muted-foreground", className)}
        data-slot="data-card-description"
      />
    );
  },
);

DataCardDescription.displayName = "DataCardDescription";

const DataCardContent = forwardRef<HTMLDivElement, DataCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        {...props}
        className={cn("px-6", className)}
        data-slot="data-card-content"
      />
    );
  },
);

DataCardContent.displayName = "DataCardContent";

export {
  DataCard,
  DataCardHeader,
  DataCardTitle,
  DataCardDescription,
  DataCardContent,
};
