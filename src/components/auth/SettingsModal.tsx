"use client";

import { KeyRound, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils";

export function SettingsModal({
  isOpen,
  onClose,
  onSignOut,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { user, sendPasswordReset } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const canChangePassword = Boolean(
    user?.providerData?.some((provider) => provider.providerId === "password"),
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
  }, [isOpen]);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsSending(true);
    setError(null);
    setInfo(null);
    try {
      await sendPasswordReset(user.email);
      setInfo("Password reset email sent.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-xl bg-neutral-900/60"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Account</div>
              <div className="mt-1 text-xs text-neutral-500">
                Manage your account access.
              </div>
            </div>
            <SettingsIcon
              size={20}
              className="text-neutral-500"
              suppressHydrationWarning
            />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {canChangePassword ? (
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={isSending}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-3 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800",
                  isSending ? "cursor-not-allowed opacity-70" : "",
                )}
              >
                <span className="flex items-center gap-2">
                  <KeyRound
                    size={16}
                    className="text-neutral-400"
                    suppressHydrationWarning
                  />
                  Change password
                </span>
                <span className="text-xs text-neutral-500">Email reset</span>
              </button>
            ) : (
              <div className="rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-xs text-neutral-500">
                Password changes are managed by your sign-in provider.
              </div>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-3 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              <span className="flex items-center gap-2">
                <LogOut
                  size={16}
                  className="text-neutral-400"
                  suppressHydrationWarning
                />
                Sign out
              </span>
            </button>
          </div>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {info && <div className="text-sm text-emerald-300">{info}</div>}
      </div>
    </Modal>
  );
}
