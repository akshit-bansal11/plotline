"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils";

export function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(user?.displayName || "");
    setPreviewUrl(null);
    setSelectedFile(null);
    setRemovePhoto(false);
    setError(null);
    setInfo(null);
  }, [isOpen, user]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    setRemovePhoto(false);
    setError(null);
  };

  const handleRemovePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setRemovePhoto(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 80) {
      setError("Name must be 80 characters or less.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setInfo(null);
    try {
      let nextPhoto = removePhoto ? null : user.photoURL || null;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("uid", user.uid);

        const response = await fetch("/api/profile-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || "Failed to upload profile image.");
        }

        const payload = (await response.json()) as { url?: string };
        if (!payload.url) {
          throw new Error("Profile image upload did not return a URL.");
        }
        nextPhoto = payload.url;
      }
      await updateUserProfile(trimmed, nextPhoto);
      setInfo("Profile updated.");
      setSelectedFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      const normalized = message.toLowerCase();
      if (normalized.includes("cloudinary") || normalized.includes("cloudinary_url")) {
        setError(
          "Profile upload failed because Cloudinary is not configured. Set CLOUDINARY_URL and restart the app.",
        );
        return;
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayPhoto = removePhoto ? null : previewUrl || user?.photoURL || null;
  const initials = (displayName.trim() || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile"
      className="max-w-2xl bg-neutral-900/60"
    >
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-neutral-900/40">
              {displayPhoto ? (
                <ImageWithSkeleton
                  src={displayPhoto}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-neutral-400">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Upload photo
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="rounded-full border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Remove
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="text-xs text-neutral-500">PNG, JPG, or WEBP</div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-400">Display name</div>
              <input
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setError(null);
                }}
                placeholder="Your name"
                className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-400">Email</div>
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-4 py-3 text-sm text-neutral-400">
                {user?.email || "No email available"}
              </div>
            </div>
          </div>
        </div>
        {error && <div className="text-sm text-red-400">{error}</div>}
        {info && <div className="text-sm text-emerald-300">{info}</div>}
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            "w-full rounded-xl bg-neutral-100/90 backdrop-blur-sm py-3 font-semibold text-neutral-950 transition-all hover:bg-neutral-100 hover:shadow-[0_0_20px_rgba(245,245,245,0.1)] active:scale-[0.98]",
            isSaving ? "cursor-not-allowed opacity-70" : "",
          )}
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </Modal>
  );
}
