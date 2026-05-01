// File: src/components/layout/Navbar.tsx
// Purpose: Main navigation bar with global search, profile menu, and modal orchestrations

"use client";

// ─── React & Next
	import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Third-party
import { Download, LogIn, LogOut, Settings, Upload, UserCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

// ─── Internal — types
import type { LoggableMedia } from "@/types/log-entry";

// ─── Internal — hooks
import { useNavbarModals } from "@/hooks/useNavbarModals";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

// ─── Internal — components
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/auth/ProfileModal";
import { SettingsModal } from "@/components/auth/SettingsModal";
import { CountrySelector } from "@/components/layout/CountrySelector";
import { MenuItem } from "@/components/layout/MenuItem";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavLinks } from "@/components/layout/NavLinks";
import { ImportExportModal } from "@/components/library/ImportExportModal";
import { LinkDropZone } from "@/components/log-entry/LinkDropZone";
import { LogEntryModal } from "@/components/log-entry/LogEntryModal";
import { GlobalSearch, type GlobalSearchHandle } from "@/components/search/GlobalSearch";

// ─── Internal — context
import { useAuth } from "@/context/AuthContext";
import { useSection } from "@/context/SectionContext";

export function Navbar() {
  const { setActiveSection } = useSection();
  const { user, signOut } = useAuth();
  const userLabel = user?.displayName || user?.email;
  const avatarUrl = user?.photoURL || null;

  // ─── Hooks: Modals
  const {
    isAuthOpen, openAuth, closeAuth,
    isLogOpen, openLog, closeLog,
    isProfileOpen, openProfile, closeProfile,
    isImportExportOpen, openImportExport, closeImportExport,
    isSettingsOpen, openSettings, closeSettings,
    isProfileMenuOpen, toggleProfileMenu, closeProfileMenu,
  } = useNavbarModals();

  // ─── State: Pending
  const [pendingItem, setPendingItem] = useState<LoggableMedia | null>(null);

  // ─── Refs
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<GlobalSearchHandle | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ─── Hooks: Shortcuts
  useGlobalShortcuts({
    onSearchOpen: () => searchRef.current?.focus(),
    onModalClose: () => {
      // Logic to close top-most modal if any
      if (isProfileMenuOpen) closeProfileMenu();
      else if (isLogOpen) closeLog();
      else if (isAuthOpen) closeAuth();
      else if (isProfileOpen) closeProfile();
      else if (isImportExportOpen) closeImportExport();
      else if (isSettingsOpen) closeSettings();
    },
  });

  // ─── Handlers
  const handleSignOut = async () => {
    await signOut();
    closeSettings();
    closeProfileMenu();
  };

  const handleGlobalSearchSelect = (item: LoggableMedia) => {
    if (!user) {
      openAuth();
      return;
    }
    setPendingItem(item);
    openLog();
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
    openLog();
  };

  // ─── Memo: Menu Items
  const menuItems = useMemo(
    () => [
      {
        label: "Profile",
        icon: UserCircle,
        onClick: () => {
          openProfile();
          closeProfileMenu();
        },
      },
      {
        label: "Import",
        icon: Upload,
        onClick: () => {
          openImportExport();
          closeProfileMenu();
        },
      },
      {
        label: "Export",
        icon: Download,
        onClick: () => {
          openImportExport();
          closeProfileMenu();
        },
      },
      {
        label: "Settings",
        icon: Settings,
        onClick: () => {
          openSettings();
          closeProfileMenu();
        },
      },
    ],
    [openProfile, openImportExport, openSettings, closeProfileMenu],
  );

  // ─── Effect: Click Outside
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeProfileMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen, closeProfileMenu]);

  // ─── Effect: Focus Management
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const first = menuItemRefs.current[0];
    if (first) first.focus();
  }, [isProfileMenuOpen]);

  // ─── Keyboard Handlers
  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      toggleProfileMenu();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleProfileMenu();
    }
    if (event.key === "Escape") {
      closeProfileMenu();
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
      closeProfileMenu();
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      <header className="bg-neutral-950/55 py-3 flex w-full items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          scroll={false}
          onClick={() => setActiveSection("home")}
          className="flex items-center gap-3 relative shrink-0 text-5xl font-extralight font-geoma text-white"
        >
          <p>Plotline</p>
        </Link>

        <div className="hidden min-w-0 items-center justify-end gap-3 md:flex">
          <NavLinks className="shrink-0" />
          <GlobalSearch
            ref={searchRef}
            className="hidden w-[200px] max-w-none focus-within:w-[480px] md:block"
            onSelectMedia={handleGlobalSearchSelect}
            onRequireAuth={openAuth}
            disabled={!user}
          />

          {userLabel ? (
            <div className="relative hidden items-center md:flex">
              <button
                ref={triggerRef}
                type="button"
                onClick={toggleProfileMenu}
                onKeyDown={handleTriggerKeyDown}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-label={userLabel || "Profile"}
                className="flex items-center rounded-full border border-white/10 bg-neutral-900/40 p-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-900/60"
              >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-900/50 text-xs font-semibold text-neutral-300">
                  {avatarUrl ? (
                    <Image
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
              onClick={openAuth}
              className="hidden items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white md:flex"
            >
              <LogIn size={16} suppressHydrationWarning />
              <span>Sign In</span>
            </button>
          )}
        </div>

        <MobileMenu
          onAuthOpen={openAuth}
          onSearchOpen={() => {
            setPendingItem(null);
            openLog();
          }}
          onProfileOpen={openProfile}
          onImportExportOpen={openImportExport}
          onSettingsOpen={openSettings}
          userLabel={userLabel}
        />
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={closeAuth} />
      <LogEntryModal
        isOpen={isLogOpen}
        onClose={() => {
          closeLog();
          setPendingItem(null);
        }}
        initialMedia={pendingItem}
      />
      <ProfileModal isOpen={isProfileOpen} onClose={closeProfile} />
      <ImportExportModal isOpen={isImportExportOpen} onClose={closeImportExport} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        onSignOut={handleSignOut}
      />
      <LinkDropZone
        onResolved={handleLinkDropResolved}
        disabled={!user}
        onRequireAuth={openAuth}
      />
    </>
  );
}
  );
}
