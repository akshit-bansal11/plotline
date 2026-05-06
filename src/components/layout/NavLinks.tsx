// File: src/components/layout/NavLinks.tsx
// Purpose: Horizontal navigation links for desktop layouts

"use client";

// ─── Third-party
import { motion } from "motion/react";
import Link from "next/link";

// ─── Internal — hooks
import { useSectionLinks } from "@/hooks/useSectionLinks";

// ─── Internal — utils
import { cn } from "@/utils";

export function NavLinks({ className }: { className?: string }) {
  const { links, setActiveSection } = useSectionLinks();

  return (
    <nav className={cn("relative flex items-center gap-1 overflow-hidden", className)}>
      {links.map((link) => {
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            scroll={false}
            onClick={() => setActiveSection(link.section)}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-300",
              link.isActive ? "text-white" : "text-neutral-400 hover:text-white",
            )}
          >
            {link.isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-neutral-800"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            {Icon ? (
              <Icon
                size={18}
                className={cn("relative z-10", link.isActive ? "text-white" : "text-neutral-400")}
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
