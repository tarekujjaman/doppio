import { useEffect, useRef, useState } from "react";

/**
 * Small popover helper for the icon-triggered menus (settings gear, session ⋯):
 * Escape closes and restores focus to the trigger; opening focuses the first item.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button, [tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return { open, setOpen, triggerRef, menuRef };
}
