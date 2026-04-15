"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { DescriptionTextarea } from "@/components/ui/DescriptionTextarea";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/utils";

type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

const mediaTypeOptions: Array<{ value: EntryMediaType; label: string }> = [
  { value: "movie", label: "Movie" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "game", label: "Game" },
];

interface NewListModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: EntryMediaType | null;
  onCreated?: (list: {
    id: string;
    name: string;
    type: EntryMediaType;
    types: EntryMediaType[];
    description: string;
  }) => void;
}

export function NewListModal({
  isOpen,
  onClose,
  defaultType,
  onCreated,
}: NewListModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [types, setTypes] = useState<EntryMediaType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedDefaultType = useMemo<EntryMediaType | "">(() => {
    if (!defaultType) return "";
    return defaultType;
  }, [defaultType]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
    setIsSaving(false);
    setName("");
    setDescription("");
    setTypes(normalizedDefaultType ? [normalizedDefaultType] : ["movie"]);
  }, [isOpen, normalizedDefaultType]);

  const handleTypeToggle = (value: EntryMediaType) => {
    setTypes((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== value);
      }
      return [...prev, value];
    });
  };

  const handleCreateList = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      setError("Please sign in to create a list.");
      return;
    }
    if (!name.trim()) {
      setError("List name is required.");
      return;
    }
    if (types.length === 0) {
      setError("Please choose at least one category.");
      return;
    }
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "users", user.uid, "lists"), {
        name: name.trim(),
        description: description.trim(),
        type: types[0],
        types,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onCreated?.({
        id: docRef.id,
        name: name.trim(),
        description: description.trim(),
        type: types[0],
        types,
      });
      setInfo("List created.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New list"
      className="bg-neutral-900/80"
      containerClassName="w-[95%] max-w-xl"
      overlayClassName="z-[120]"
    >
      <form onSubmit={handleCreateList} className="space-y-4">
        <div>
          <label
            htmlFor="list-name"
            className="block text-sm font-medium text-neutral-200 mb-2"
          >
            List name
          </label>
          <input
            id="list-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Cozy Winter Reads"
            className="w-full rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-neutral-200 mb-2">
            Category
          </legend>

          <div className="flex flex-wrap gap-2">
            {mediaTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTypeToggle(option.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                  types.includes(option.value)
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                    : "border-white/10 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-neutral-200 mb-2"
          >
            Description
          </label>
          <DescriptionTextarea
            id="description"
            value={description}
            onValueChange={setDescription}
            rows={4}
            placeholder="Optional description"
          />
        </div>
        <div className="space-y-2">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-300">{info}</p>}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            "w-full rounded-xl bg-white/90 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-white",
            isSaving ? "cursor-not-allowed opacity-70" : "",
          )}
        >
          {isSaving ? "Creating..." : "Create list"}
        </button>
      </form>
    </Modal>
  );
}
