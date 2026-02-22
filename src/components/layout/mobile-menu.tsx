"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Search, LogIn, List, UserCircle, Upload, Settings } from "lucide-react";
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

interface MobileMenuProps {
    onAuthOpen: () => void;
    onSearchOpen: () => void;
    onListsOpen: () => void;
    onProfileOpen: () => void;
    onImportExportOpen: () => void;
    onSettingsOpen: () => void;
    userLabel?: string | null;
}

export function MobileMenu({
    onAuthOpen,
    onSearchOpen,
    onListsOpen,
    onProfileOpen,
    onImportExportOpen,
    onSettingsOpen,
    userLabel,
}: MobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { activeSection, setActiveSection } = useSection();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(t);
    }, []);

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    return (
        <div className="md:hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-[70] p-2 text-neutral-400 transition-colors hover:text-white"
                aria-label="Toggle menu"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {mounted && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-neutral-950/80"
                        >
                            <nav className="flex flex-col items-center gap-6">
                                {links.map((link, index) => (
                                    <motion.div
                                        key={link.href}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        transition={{ delay: index * 0.1, duration: 0.4 }}
                                    >
                                        <Link
                                            href={link.href}
                                            scroll={false}
                                            onClick={() => {
                                                setActiveSection(link.section);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "text-2xl font-medium transition-colors",
                                                activeSection === link.section
                                                    ? "text-white"
                                                    : "text-neutral-400 hover:text-white"
                                            )}
                                        >
                                            {link.label}
                                        </Link>
                                    </motion.div>
                                ))}
                            </nav>
                            <div className="mt-10 flex flex-col gap-3 w-full px-8 max-w-xs">
                                <button
                                    onClick={() => {
                                        onSearchOpen();
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 rounded-full bg-white/5 text-neutral-200 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    <Search size={16} suppressHydrationWarning />
                                    <span>Search</span>
                                </button>
                                {userLabel ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                onListsOpen();
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 rounded-full bg-white/5 text-neutral-200 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <List size={16} suppressHydrationWarning />
                                            <span>Lists</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onProfileOpen();
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 rounded-full bg-white/5 text-neutral-200 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <UserCircle size={16} suppressHydrationWarning />
                                            <span>Profile</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onImportExportOpen();
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 rounded-full bg-white/5 text-neutral-200 py-3 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            <Upload size={16} suppressHydrationWarning />
                                            <span>Import/Export</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                onSettingsOpen();
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-800/50 border border-white/5 py-3 text-neutral-300 font-medium transition-colors hover:bg-neutral-800 hover:text-white"
                                        >
                                            <Settings size={16} suppressHydrationWarning />
                                            <span>Settings</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            onAuthOpen();
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-800/50 border border-white/5 py-3 text-neutral-300 font-medium transition-colors hover:bg-neutral-800 hover:text-white"
                                    >
                                        <LogIn size={16} suppressHydrationWarning />
                                        <span>Sign in</span>
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
