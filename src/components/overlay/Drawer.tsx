// File: src/components/overlay/Drawer.tsx
// Purpose: Side-sliding drawer container for mobile menus and detailed views

"use client";

// ─── React
import { useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";

// ─── Third-party
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// ─── Internal — utils
import { cn } from "@/utils";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right" | "bottom";
  className?: string;
}

export function Drawer({ isOpen, onClose, children, side = "right", className }: DrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  if (typeof document === "undefined") return null;

  const variants = {
    initial: {
      x: side === "right" ? "100%" : side === "left" ? "-100%" : 0,
      y: side === "bottom" ? "100%" : 0,
    },
    animate: { x: 0, y: 0 },
    exit: {
      x: side === "right" ? "100%" : side === "left" ? "-100%" : 0,
      y: side === "bottom" ? "100%" : 0,
    },
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm"
          />

          <motion.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "relative h-full bg-neutral-900 border-l border-white/5 shadow-2xl overflow-y-auto",
              side === "bottom"
                ? "w-full h-auto border-t border-l-0 self-end rounded-t-2xl"
                : "w-full max-w-md",
              className,
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="p-6 h-full">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
