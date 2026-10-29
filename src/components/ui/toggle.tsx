"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Toggle as TogglePrimitive } from "radix-ui";

// Restyled to the site tokens. Pressed shows in teal so the state reads
// without relying on the icon alone.
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-ui font-semibold tracking-wider whitespace-nowrap uppercase text-foreground transition-colors duration-(--motion-courtly-duration) ease-courtly hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent data-[state=on]:border-primary",
      },
      size: {
        default: "h-11 min-w-11 px-3 text-sm",
        sm: "h-9 min-w-9 px-2 text-xs",
        lg: "h-12 min-w-12 px-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
