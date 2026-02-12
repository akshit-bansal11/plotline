"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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
    onCreated?: (list: { id: string; name: string; type: EntryMediaType; description: string }) => void;
}

export function NewListModal({ isOpen, onClose, defaultType, onCreated }: NewListModalProps) {
    const { user } = useAuth();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<EntryMediaType | "">("");
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
        setType(normalizedDefaultType || "movie");
    }, [isOpen, normalizedDefaultType]);

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
        if (!type) {
            setError("Please choose a category.");
            return;
        }
        setError(null);
        setInfo(null);
        setIsSaving(true);
        try {
            const docRef = await addDoc(collection(db, "users", user.uid, "lists"), {
                name: name.trim(),
                description: description.trim(),
                type,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            onCreated?.({
                id: docRef.id,
                name: name.trim(),
                description: description.trim(),
                type,
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
                    <label className="block text-sm font-medium text-neutral-200 mb-2">
                        List name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Cozy Winter Reads"
                        className="w-full rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {mediaTypeOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setType(option.value)}
                                className={cn(
                                    "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                                    type === option.value
                                        ? "border-white/40 bg-white/10 text-white"
                                        : "border-white/10 bg-neutral-900/40 text-neutral-300 hover:border-white/30"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={4}
                        placeholder="Optional description"
                        className="w-full resize-none rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
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
                        isSaving ? "cursor-not-allowed opacity-70" : ""
                    )}
                >
                    {isSaving ? "Creating..." : "Create list"}
                </button>
            </form>
        </Modal>
    );
}
