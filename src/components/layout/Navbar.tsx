"use client";

import { Download, LogIn, LogOut, Settings, Upload, UserCircle } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/auth/ProfileModal";
import { SettingsModal } from "@/components/auth/SettingsModal";
import { CountrySelector } from "@/components/layout/CountrySelector";
import { MenuItem } from "@/components/layout/MenuItem";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavLinks } from "@/components/layout/NavLinks";
import { ImportExportModal } from "@/components/library/ImportExportModal";
import { LinkDropZone } from "@/components/log/LinkDropZone";
import { LogEntryModal, type LoggableMedia } from "@/components/log/LogEntryModal";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useSection } from "@/context/SectionContext";
import { cn } from "@/utils";

export function Navbar() {
  const { scrollY } = useScroll();
  const { setActiveSection } = useSection();
  const { user, signOut } = useAuth();
  const userLabel = user?.displayName || user?.email;
  const avatarUrl = user?.photoURL || null;

  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<LoggableMedia | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleSignOut = async () => {
    await signOut();
    setIsSettingsOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleGlobalSearchSelect = (item: LoggableMedia) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setPendingItem(item);
    setIsLogOpen(true);
  };

  const handleLinkDropResolved = (media: {
    id: string;
    title: string;
    image: string | null;
    year?: string;
    type: "movie" | "series" | "anime" | "manga" | "game";
    description?: string;
    rating?: number | null;
    imdbRating?: number | null;
    lengthMinutes?: number | null;
    episodeCount?: number | null;
    chapterCount?: number | null;
    genresThemes?: string[];
  }) => {
    const item: LoggableMedia = {
      id: media.id,
      title: media.title,
      image: media.image,
      year: media.year,
      type: media.type,
      description: media.description,
      rating: media.rating,
      imdbRating: media.imdbRating,
      lengthMinutes: media.lengthMinutes,
      episodeCount: media.episodeCount,
      chapterCount: media.chapterCount,
      genresThemes: media.genresThemes,
    };
    setPendingItem(item);
    setIsLogOpen(true);
  };

  const menuItems = useMemo(
    () => [
      {
        label: "Profile",
        icon: UserCircle,
        onClick: () => {
          setIsProfileOpen(true);
          setIsProfileMenuOpen(false);
        },
      },
      {
        label: "Import",
        icon: Upload,
        onClick: () => {
          setIsImportExportOpen(true);
          setIsProfileMenuOpen(false);
        },
      },
      {
        label: "Export",
        icon: Download,
        onClick: () => {
          setIsImportExportOpen(true);
          setIsProfileMenuOpen(false);
        },
      },
      {
        label: "Settings",
        icon: Settings,
        onClick: () => {
          setIsSettingsOpen(true);
          setIsProfileMenuOpen(false);
        },
      },
    ],
    [],
  );

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const first = menuItemRefs.current[0];
    if (first) first.focus();
  }, [isProfileMenuOpen]);

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsProfileMenuOpen(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsProfileMenuOpen((prev) => !prev);
    }
    if (event.key === "Escape") {
      setIsProfileMenuOpen(false);
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = menuItemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[prevIndex]?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsProfileMenuOpen(false);
      triggerRef.current?.focus();
    }
  };

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY;
    setLastScrollY(latest);

    if (latest > 50) {
      setIsScrolled(true);
    } else {
      setIsScrolled(false);
    }

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
          "fixed left-0 right-0 top-0 z-40 transition-all duration-300",
          isScrolled ? "bg-neutral-950/55 py-3 backdrop-blur-xl" : "bg-transparent py-5",
        )}
      >
        <div className="flex w-full items-center justify-between px-4 md:px-8">
          <Link
            href="/"
            scroll={false}
            onClick={() => setActiveSection("home")}
            className="flex items-center gap-3 relative z-50 shrink-0 text-5xl font-extralight font-geoma text-white"
          >
            <p>Plotline</p>
          </Link>

          <div className="hidden min-w-0 items-center justify-end gap-3 md:flex">
            <NavLinks className="shrink-0" />
            <GlobalSearch
              className="hidden w-[200px] max-w-none focus-within:w-[480px] md:block"
              onSelectMedia={handleGlobalSearchSelect}
              onRequireAuth={() => setIsAuthOpen(true)}
              disabled={!user}
            />

            {userLabel ? (
              <div className="relative hidden items-center md:flex">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  onKeyDown={handleTriggerKeyDown}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  aria-label={userLabel || "Profile"}
                  className="flex items-center rounded-full border border-white/10 bg-neutral-900/40 p-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-900/60"
                >
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-900/50 text-xs font-semibold text-neutral-300">
                    {avatarUrl ? (
                      <ImageWithSkeleton
                        src={avatarUrl}
                        alt={userLabel || "User"}
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (userLabel || "U").slice(0, 1).toUpperCase()
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      ref={menuRef}
                      role="menu"
                      onKeyDown={handleMenuKeyDown}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                    >
                      <div className="mb-2 rounded-xl border border-white/5 bg-neutral-900/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {userLabel}
                            </div>
                            <div className="text-[11px] text-neutral-500">{user?.email || ""}</div>
                          </div>
                          <CountrySelector />
                        </div>
                      </div>

                      <div className="space-y-1">
                        {menuItems.map((item, index) => (
                          <MenuItem
                            key={item.label}
                            label={item.label}
                            icon={item.icon}
                            onClick={item.onClick}
                            buttonRef={(node) => {
                              menuItemRefs.current[index] = node;
                            }}
                          />
                        ))}
                      </div>
                      <div className="my-1 h-px bg-white/10" />
                      <MenuItem
                        label="Log out"
                        icon={LogOut}
                        onClick={handleSignOut}
                        className="text-neutral-400 hover:!bg-red-500/10 hover:!text-red-400"
                        buttonRef={(node) => {
                          menuItemRefs.current[menuItems.length] = node;
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="hidden items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white md:flex"
              >
                <LogIn size={16} suppressHydrationWarning />
                <span>Sign In</span>
              </button>
            )}
          </div>

          <MobileMenu
            onAuthOpen={() => setIsAuthOpen(true)}
            onSearchOpen={() => {
              setPendingItem(null);
              setIsLogOpen(true);
            }}
            onProfileOpen={() => setIsProfileOpen(true)}
            onImportExportOpen={() => setIsImportExportOpen(true)}
            onSettingsOpen={() => setIsSettingsOpen(true)}
            userLabel={userLabel}
          />
        </div>
      </motion.header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <LogEntryModal
        isOpen={isLogOpen}
        onClose={() => {
          setIsLogOpen(false);
          setPendingItem(null);
        }}
        initialMedia={pendingItem}
      />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <ImportExportModal isOpen={isImportExportOpen} onClose={() => setIsImportExportOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSignOut={handleSignOut}
      />
      <LinkDropZone
        onResolved={handleLinkDropResolved}
        disabled={!user}
        onRequireAuth={() => setIsAuthOpen(true)}
      />
    </>
  );
}
