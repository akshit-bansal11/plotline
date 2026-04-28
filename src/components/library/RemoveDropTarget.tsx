import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/utils";

export function RemoveDropTarget({
  isVisible,
  isActive,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  isVisible: boolean;
  isActive: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <button
            type="button"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full border text-white shadow-2xl backdrop-blur-xl transition-colors",
              isActive
                ? "border-red-300/80 bg-red-500/30"
                : "border-white/20 bg-neutral-900/70",
            )}
            title="Drop here to remove from list"
          >
            <X size={24} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
