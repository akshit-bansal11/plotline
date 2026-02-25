"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";

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

export function Modal({ isOpen, onClose, children, title, className, containerClassName, overlayClassName, hideHeader }: ModalProps) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        },
        [onClose]
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

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className={cn("fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6", overlayClassName)}>
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                        className={cn("relative w-full max-w-lg", containerClassName)}
                    >
                        <GlassCard className={cn("flex flex-col overflow-hidden border-white/10 p-0 shadow-2xl", className)}>
                            {/* Header */}
                            {!hideHeader && (
                                <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-6 py-4">
                                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                                    <button
                                        onClick={onClose}
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
        document.body
    );
}
