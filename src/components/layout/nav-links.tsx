"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useSection, type SectionKey } from "@/context/section-context";

const links: Array<{ href: string; label: string; section: SectionKey }> = [
    { href: "/", label: "Home", section: "home" },
    { href: "/#movies", label: "Movies", section: "movies" },
    { href: "/#series", label: "Series", section: "series" },
    { href: "/#anime", label: "Anime", section: "anime" },
    { href: "/#manga", label: "Manga", section: "manga" },
    { href: "/#games", label: "Games", section: "games" },
];

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
            {links.map((link) => {
                const isActive = activeSection === link.section;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        scroll={false}
                        onClick={() => setActiveSection(link.section)}
                        className={cn(
                            "relative px-4 py-2 text-sm font-medium transition-colors duration-300",
                            isActive ? "text-white" : "text-neutral-400 hover:text-white"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                key={`nav-pill-${activeSection}`}
                                initial={{ opacity: 0, scaleX: 0, scaleY: 0, y: 10 }}
                                animate={{ opacity: 1, scaleX: 1, scaleY: 1, y: 0 }}
                                transition={{ type: "spring", bounce: 0.15, duration: 0.55 }}
                                style={{ transformOrigin: "0% 100%" }}
                                className="absolute inset-0 rounded-full bg-neutral-800"
                            />
                        )}
                        <span className="relative z-10">{link.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
