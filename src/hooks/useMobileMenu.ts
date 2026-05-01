// File: src/hooks/useMobileMenu.ts
// Purpose: Manages mobile menu open/close state and related side effects

"use client";

// ─── React
import { useCallback, useEffect, useState } from "react";

/**
 * Hook to manage mobile menu state and body scroll locking.
 */
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return {
    isOpen,
    mounted,
    toggleMenu,
    closeMenu,
  };
}
