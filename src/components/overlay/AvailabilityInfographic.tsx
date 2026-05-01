// File: src/components/overlay/AvailabilityInfographic.tsx
// Purpose: Informational badge encouraging users to select a region for streaming availability

"use client";

// ─── React
import { AnimatePresence, motion } from "motion/react";

// ─── Third-party
import { Globe } from "lucide-react";

// ─── Internal — context
import { useData } from "@/context/DataContext";

export function AvailabilityInfographic() {
  const { selectedCountry } = useData();

  return (
    <AnimatePresence>
      {!selectedCountry && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.4, delay: 1 }}
          className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-2xl backdrop-blur-xl max-w-xs"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Select a country</p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Choose your region in the navbar to see available streaming services.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
