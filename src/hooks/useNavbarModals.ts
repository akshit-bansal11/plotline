// File: src/hooks/useNavbarModals.ts
// Purpose: Manages all modal open/close state for the Navbar component

import { useCallback, useState } from "react";

/**
 * Hook to manage the state and visibility of all modals controlled by the Navbar.
 */
export function useNavbarModals() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const openAuth = useCallback(() => setIsAuthOpen(true), []);
  const closeAuth = useCallback(() => setIsAuthOpen(false), []);

  const openLog = useCallback(() => setIsLogOpen(true), []);
  const closeLog = useCallback(() => setIsLogOpen(false), []);

  const openProfile = useCallback(() => setIsProfileOpen(true), []);
  const closeProfile = useCallback(() => setIsProfileOpen(false), []);

  const openImportExport = useCallback(() => setIsImportExportOpen(true), []);
  const closeImportExport = useCallback(() => setIsImportExportOpen(false), []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const toggleProfileMenu = useCallback(() => setIsProfileMenuOpen((prev) => !prev), []);
  const closeProfileMenu = useCallback(() => setIsProfileMenuOpen(false), []);

  return {
    isAuthOpen,
    openAuth,
    closeAuth,
    isLogOpen,
    openLog,
    closeLog,
    isProfileOpen,
    openProfile,
    closeProfile,
    isImportExportOpen,
    openImportExport,
    closeImportExport,
    isSettingsOpen,
    openSettings,
    closeSettings,
    isProfileMenuOpen,
    toggleProfileMenu,
    closeProfileMenu,
  };
}
