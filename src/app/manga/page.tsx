"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { MediaGrid } from "@/components/content/media-grid";
import { MediaSection } from "@/components/content/media-section";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";

type EntryDoc = {
    id: string;
    title: string;
    mediaType: string;
    image: string | null;
    year: string | null;
    createdAtMs: number | null;
    genresThemes: string[];
};

const toMillis = (value: unknown): number | null => {
    if (!value) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
        const millis = (value as { toMillis: () => number }).toMillis();
        return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
    }
    return null;
};

export default function MangaPage() {
    const { user } = useAuth();
    const uid = user?.uid || null;
    const [entriesState, setEntriesState] = useState<{ uid: string | null; entries: EntryDoc[] }>({ uid: null, entries: [] });
    const [entriesError, setEntriesError] = useState<{ uid: string; message: string } | null>(null);

    useEffect(() => {
        if (!uid) return;

        const entriesQuery = query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(1000));
        const unsubscribe = onSnapshot(
            entriesQuery,
            (snapshot) => {
                const next: EntryDoc[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as Partial<EntryDoc> & { createdAt?: unknown; genresThemes?: unknown };
                    const genresThemes = Array.isArray(data.genresThemes)
                        ? data.genresThemes.filter((value): value is string => typeof value === "string")
                        : [];
                    return {
                        id: docSnap.id,
                        title: String(data.title || ""),
                        mediaType: String(data.mediaType || ""),
                        image: data.image ? String(data.image) : null,
                        year: data.year ? String(data.year) : null,
                        createdAtMs: toMillis(data.createdAt),
                        genresThemes,
                    };
                });
                setEntriesState({ uid, entries: next });
                setEntriesError(null);
            },
            (err) => {
                setEntriesState({ uid, entries: [] });
                const message = err instanceof Error ? err.message : "Failed to load entries.";
                setEntriesError({ uid, message });
            }
        );

        return () => unsubscribe();
    }, [uid]);

    const mangaEntries = useMemo(
        () =>
            (uid && entriesState.uid === uid ? entriesState.entries : []).filter((entry) => entry.mediaType === "manga"),
        [entriesState, uid]
    );
    const visibleEntriesError = uid && entriesError?.uid === uid ? entriesError.message : null;

    return (
        <div className="container mx-auto px-4 md:px-6 py-12 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Manga</h1>
                <p className="text-neutral-400">Your logged manga.</p>
            </div>

            {!uid ? (
                <div className="text-sm text-neutral-500">Sign in to see your library.</div>
            ) : visibleEntriesError ? (
                <div className="text-sm text-red-400">{visibleEntriesError}</div>
            ) : (
                <MediaSection items={mangaEntries} getGenresThemes={(entry) => entry.genresThemes} title="Results">
                    {(filteredEntries) =>
                        filteredEntries.length === 0 ? (
                            <div className="text-sm text-neutral-400">No manga found.</div>
                        ) : (
                            <MediaGrid
                                items={filteredEntries.map((entry) => ({
                                    id: entry.id,
                                    title: entry.title,
                                    image: entry.image,
                                    year: entry.year || undefined,
                                    type: "manga",
                                }))}
                            />
                        )
                    }
                </MediaSection>
            )}
        </div>
    );
}
