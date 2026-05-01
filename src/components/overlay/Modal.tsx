// File: src/components/overlay/Modal.tsx
// Purpose: Generic modal container with animations, z-index management, and accessibility features

"use client";

// ─── React
import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// ─── Third-party
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// ─── Internal — components
import { GlassCard } from "@/components/ui/GlassCard";

// ─── Internal — utils
import { cn } from "@/utils";
import { acquireModalZIndex } from "./modalStack";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  containerClassName?: string;
  overlayClassName?: string;
  hideHeader?: boolean;
}

/**
 * A reusable modal component that handles animations, z-index stacking,
 * and keyboard interactions (Escape key, focus trapping).
 */
export function Modal({
  isOpen,
  onClose,
  children,
  title,
  className,
  containerClassName,
  overlayClassName,
  hideHeader,
}: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);

  // ─── Handler: Keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  // ─── Effect: Focus Trap & Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    // Initial focus: find the first focusable element or focus the close button
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusableElements && focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen, handleKeyDown]);

  // ─── Internal: Z-Index Management
  const zIndexRef = useRef<number | null>(null);
  if (isOpen && zIndexRef.current === null) {
    zIndexRef.current = acquireModalZIndex();
  }
  if (!isOpen) {
    zIndexRef.current = null;
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center p-4 sm:p-6",
            overlayClassName,
          )}
          style={zIndexRef.current ? { zIndex: zIndexRef.current } : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
        >
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/60"
            aria-hidden="true"
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
            className={cn("relative w-full max-w-lg", containerClassName)}
          >
            <GlassCard
              className={cn(
                "flex flex-col overflow-hidden border-white/10 p-0 shadow-2xl",
                className,
              )}
            >
              {/* Header */}
              {!hideHeader && (
                <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
                  <h3 id={titleId} className="text-lg font-semibold text-white">
                    {title}
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close modal"
                    className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{children}</div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
