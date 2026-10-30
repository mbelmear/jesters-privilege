import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// Restyled to the site tokens: UI typeface in small capitals, crisp corners,
// and the orange focus ring. Teal is the primary action; the orange `brand`
// fill takes dark text, per the contrast rule in globals.css.
const buttonClasses = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-ui font-semibold tracking-wider whitespace-nowrap uppercase no-underline transition-colors duration-(--motion-courtly-duration) ease-courtly select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        brand: "bg-brand text-on-brand hover:bg-brand/85",
        outline:
          "border-primary bg-transparent text-primary hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 aria-expanded:bg-secondary/70",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted aria-pressed:bg-muted",
        destructive:
          "border-destructive bg-transparent text-destructive hover:bg-destructive/10",
        link: "h-auto px-0 font-body tracking-normal normal-case text-primary underline underline-offset-3 hover:decoration-2",
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// The classes for a button-styled element, with each variant's classes
// replacing the base's where they clash (border-primary over
// border-transparent), so a link styled this way matches <Button>.
function buttonVariants(props?: Parameters<typeof buttonClasses>[0]): string {
  return cn(buttonClasses(props));
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonClasses> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
