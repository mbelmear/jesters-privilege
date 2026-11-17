"use client";

import { MenuIcon } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Menu } from "./mobile-menu-panel";

type Props = { menu: Menu };

// The panel, with Radix and Motion, is its own chunk: fetched when a finger
// or pointer nears the button, so every page ships only the button.
const loadPanel = () => import("./mobile-menu-panel");
const MobileMenuPanel = lazy(loadPanel);

/** The phone menu's button, and the panel once it has been opened. */
export function MobileMenu({ menu }: Props) {
  const [open, setOpen] = useState(false);
  // The panel stays mounted after the first open so it can animate closed.
  const [opened, setOpened] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={loadPanel}
        onTouchStart={loadPanel}
        onFocus={loadPanel}
        onClick={() => {
          setOpened(true);
          setOpen(true);
        }}
      >
        <MenuIcon aria-hidden className="size-6" />
        <span className="sr-only">{menu.labels.open}</span>
      </Button>
      {opened && (
        <Suspense fallback={null}>
          <MobileMenuPanel
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            menu={menu}
          />
        </Suspense>
      )}
    </>
  );
}
