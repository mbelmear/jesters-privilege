"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { MotionProvider } from "@/components/motion-provider";
import { Button } from "@/components/ui/button";
import type { NavItem, Shell } from "@/lib/content";
import { motionPresets, transitionFor } from "@/lib/motion";

export type MenuPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Focused again once the menu closes.
  trigger: React.RefObject<HTMLButtonElement | null>;
  items: readonly NavItem[];
  labels: Shell["menu"];
  navLabel: string;
};

const courtly = transitionFor(motionPresets.courtly);

/**
 * The menu's sliding panel, a modal dialog: focus stays inside while it's
 * open, and Escape, a tap outside, the close button, or a link closes it.
 * Loaded by MobileMenu on demand, so Radix and Motion stay off the page until
 * the menu is wanted.
 */
export default function MobileMenuPanel({
  open,
  onOpenChange,
  trigger,
  items,
  labels,
  navLabel,
}: MenuPanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <MotionProvider>
        <AnimatePresence>
          {open && (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay asChild forceMount>
                <m.div
                  className="fixed inset-0 z-50 bg-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={courtly}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content
                asChild
                forceMount
                aria-describedby={undefined}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  trigger.current?.focus();
                }}
              >
                <m.div
                  className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col gap-6 overflow-y-auto border-l-4 border-brand bg-background p-6 shadow-lg outline-none"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={courtly}
                >
                  <div className="flex items-center justify-between">
                    <DialogPrimitive.Title className="font-ui text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                      {labels.title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Close asChild>
                      <Button variant="ghost" size="icon">
                        <XIcon aria-hidden className="size-6" />
                        <span className="sr-only">{labels.close}</span>
                      </Button>
                    </DialogPrimitive.Close>
                  </div>
                  <nav aria-label={navLabel}>
                    <ul className="flex flex-col">
                      {items.map((item) => (
                        <li key={item.href}>
                          <DialogPrimitive.Close asChild>
                            <Link
                              href={item.href}
                              className="block border-b border-border py-4 font-display text-3xl text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {item.label}
                            </Link>
                          </DialogPrimitive.Close>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </m.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </MotionProvider>
    </DialogPrimitive.Root>
  );
}
