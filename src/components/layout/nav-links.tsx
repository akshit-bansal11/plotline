"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookOpen, Film, Gamepad2, Home, Sparkles, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSection, type SectionKey } from "@/context/section-context";

const links: Array<{ href: string; label: string; section: SectionKey; icon: typeof Home }> = [
    { href: "/", label: "Home", section: "home", icon: Home },
    { href: "/#movies", label: "Movies", section: "movies", icon: Film },
    { href: "/#series", label: "Series", section: "series", icon: Tv },
    { href: "/#anime", label: "Anime", section: "anime", icon: Sparkles },
    { href: "/#manga", label: "Manga", section: "manga", icon: BookOpen },
    { href: "/#games", label: "Games", section: "games", icon: Gamepad2 },
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
                const Icon = link.icon;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        scroll={false}
                        onClick={() => setActiveSection(link.section)}
                        className={cn(
                            "relative flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-300",
                            isActive ? "text-white" : "text-neutral-400 hover:text-white"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="nav-pill"
                                className="absolute inset-0 rounded-full bg-neutral-800"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                        )}
                        <Icon
                            size={18}
                            className={cn("relative z-10", isActive ? "text-white" : "text-neutral-400")}
                            suppressHydrationWarning
                        />
                        <span className="relative z-10">{link.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
