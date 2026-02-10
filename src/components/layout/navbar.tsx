"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { User, Search, LogOut, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLinks } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { AuthModal } from "@/components/auth/auth-modal";
import { SearchModal, type SearchResult } from "@/components/search/search-modal";
import { LogEntryModal, type LoggableMedia } from "@/components/entry/log-entry-modal";
import { MyListsModal } from "@/components/lists/my-lists-modal";
import { useAuth } from "@/context/auth-context";

export function Navbar() {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [isMyListsOpen, setIsMyListsOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState<LoggableMedia | null>(null);
    const { user, signOut } = useAuth();
    const userLabel = user?.displayName || user?.email;

    const toLoggable = (item: SearchResult): LoggableMedia => item;

    const handleLogFromSearch = (item: SearchResult) => {
        if (!user) {
            setIsAuthOpen(true);
            return;
        }
        setPendingItem(toLoggable(item));
        setIsSearchOpen(false);
        setIsLogOpen(true);
    };

    const handleAddToListFromSearch = (item: SearchResult) => {
        if (!user) {
            setIsAuthOpen(true);
            return;
        }
        setPendingItem(toLoggable(item));
        setIsSearchOpen(false);
        setIsMyListsOpen(true);
    };

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = lastScrollY;
        setLastScrollY(latest);

        // Show background when scrolled
        if (latest > 50) {
            setIsScrolled(true);
        } else {
            setIsScrolled(false);
        }

        // Hide navbar when scrolling down, show when scrolling up
        if (latest > previous && latest > 150) {
            setIsHidden(true);
        } else {
            setIsHidden(false);
        }
    });

    return (
        <>
            <motion.header
                variants={{
                    visible: { y: 0 },
                    hidden: { y: "-100%" },
                }}
                animate={isHidden ? "hidden" : "visible"}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className={cn(
                    "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
                    isScrolled
                        ? "backdrop-blur-xl bg-neutral-950/50 py-3"
                        : "bg-transparent py-5"
                )}
            >
                <div className="container mx-auto flex items-center justify-between px-4 md:px-6">
                    <Link
                        href="/"
                        className="relative z-50 text-3xl font-bold tracking-tight text-white"
                    >
                        Plotline<span className="text-neutral-600">.</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:block">
                            <NavLinks />
                        </div>

                        {user && (
                            <button
                                onClick={() => setIsMyListsOpen(true)}
                                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <List size={16} />
                                <span>Lists</span>
                            </button>
                        )}

                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <Search size={16} />
                            <span>Search</span>
                        </button>

                        {userLabel ? (
                            <div className="hidden md:flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-neutral-300">
                                    <User size={16} />
                                    <span className="max-w-[140px] truncate">{userLabel}</span>
                                </div>
                                <button
                                    onClick={() => signOut()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-800/50 border border-white/5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
                                >
                                    <LogOut size={16} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAuthOpen(true)}
                                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <User size={16} />
                                <span>Sign In</span>
                            </button>
                        )}

                        <MobileMenu
                            onAuthOpen={() => setIsAuthOpen(true)}
                            onSearchOpen={() => setIsSearchOpen(true)}
                            onListsOpen={() => setIsMyListsOpen(true)}
                            onSignOut={() => signOut()}
                            userLabel={userLabel}
                        />
                    </div>
                </div>
            </motion.header>

            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onLog={handleLogFromSearch}
                onAddToList={handleAddToListFromSearch}
            />
            <LogEntryModal
                isOpen={isLogOpen}
                onClose={() => {
                    setIsLogOpen(false);
                    setPendingItem(null);
                }}
                initialMedia={pendingItem}
            />
            <MyListsModal
                isOpen={isMyListsOpen}
                onClose={() => {
                    setIsMyListsOpen(false);
                    setPendingItem(null);
                }}
                initialItem={pendingItem}
            />
        </>
    );
}
