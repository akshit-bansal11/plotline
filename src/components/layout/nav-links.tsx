"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const links = [
    { href: "/", label: "Home" },
    { href: "/movies", label: "Movies" },
    { href: "/series", label: "Series" },
    { href: "/anime", label: "Anime" },
    { href: "/manga", label: "Manga" },
    { href: "/games", label: "Games" },
];

export function NavLinks({ className }: { className?: string }) {
    const pathname = usePathname();

    return (
        <nav className={cn("flex items-center gap-1", className)}>
            {links.map((link) => {
                const isActive = pathname === link.href;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "relative px-4 py-2 text-sm font-medium transition-colors duration-300",
                            isActive ? "text-white" : "text-neutral-400 hover:text-white"
                        )}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="nav-pill"
                                className="absolute inset-0 rounded-full bg-neutral-800"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10">{link.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
