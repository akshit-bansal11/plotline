"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { allSectionLinks } from "@/config/navigation";
import { useSection } from "@/context/SectionContext";
import { cn } from "@/utils";

export function NavLinks({ className }: { className?: string }) {
  const { activeSection, setActiveSection } = useSection();

  // If pathname is not root, we might be on a sub-route (unlikely in SPA mode but possible if we kept old routes)
  // However, our SPA logic assumes everything is on root or redirects to root with hash.
  // For safety, if we are NOT at root, we assume the pathname dictates section?
  // Actually, our SPA logic in page.tsx handles hash.
  // If pathname is /movies, the server redirect (next.config.js) sends us to /#movies.
  // So we can rely on activeSection from context which syncs with hash.

  return (
    <nav className={cn("relative flex items-center gap-1 overflow-hidden", className)}>
      {allSectionLinks.map((link) => {
        const isActive = activeSection === link.section;
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            scroll={false}
            onClick={() => setActiveSection(link.section)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-300",
              isActive ? "text-white" : "text-neutral-400 hover:text-white",
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-neutral-800"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            {Icon ? (
              <Icon
                size={18}
                className={cn("relative z-10", isActive ? "text-white" : "text-neutral-400")}
                suppressHydrationWarning
              />
            ) : null}
            <span className="relative z-10">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
