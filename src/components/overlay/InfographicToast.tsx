"use client";

import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export function InfographicToast({
  isOpen,
  title,
  message,
  onClose,
  durationMs = 3500,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-red-400/25 bg-neutral-950/85 p-4 shadow-2xl backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs leading-relaxed text-neutral-300">
              {message}
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
