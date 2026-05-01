// File: src/hooks/useGlobalShortcuts.ts
// Purpose: Manages global keyboard shortcuts for the application

"use client";

// ─── React
import { useEffect } from "react";

interface GlobalShortcutsOptions {
  onSearchOpen?: () => void;
  onModalClose?: () => void;
  disabled?: boolean;
}

/**
 * Hook to register global keyboard shortcuts.
 */
export function useGlobalShortcuts({
  onSearchOpen,
  onModalClose,
  disabled = false,
}: GlobalShortcutsOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        if (event.key === "Escape") {
          onModalClose?.();
        }
        return;
      }

      // Shortcut: / or Ctrl+K to open search
      if (event.key === "/" || (event.key === "k" && (event.ctrlKey || event.metaKey))) {
        if (onSearchOpen) {
          event.preventDefault();
          onSearchOpen();
        }
      }

      // Shortcut: Escape to close modals
      if (event.key === "Escape") {
        onModalClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSearchOpen, onModalClose, disabled]);
}
