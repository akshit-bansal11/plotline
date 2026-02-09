"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type SourceKey = "tmdb" | "omdb" | "mal";
type MediaType = "movie" | "series" | "anime";

interface SearchResult {
    id: string | number;
    title: string;
    image: string | null;
    year?: string;
    type: MediaType;
    source: SourceKey;
    overview?: string;
    rating?: number | null;
}

interface SearchResponse {
    results: SearchResult[];
    errors?: string[];
    cached?: boolean;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const sourceLabels: Record<SourceKey, string> = {
    tmdb: "TMDB",
    omdb: "OMDb",
    mal: "MyAnimeList",
};

const typeLabels: Record<MediaType, string> = {
    movie: "Movies",
    series: "Series",
    anime: "Anime",
};

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<SourceKey[]>(["tmdb", "omdb", "mal"]);
    const [selectedTypes, setSelectedTypes] = useState<MediaType[]>(["movie", "series", "anime"]);
    const cacheRef = useRef<Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>>(new Map());
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setQuery("");
            setResults([]);
            setErrors([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        if (query.trim().length < 2) {
            setResults([]);
            setErrors([]);
            return;
        }

        const handle = setTimeout(async () => {
            const sources = selectedSources.join(",");
            const key = `${query.trim().toLowerCase()}|${sources}`;
            const cached = cacheRef.current.get(key);
            const now = Date.now();
            if (cached && now - cached.timestamp < 1000 * 60 * 5) {
                setResults(cached.results);
                setErrors(cached.errors);
                return;
            }

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);
            setErrors([]);

            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&sources=${sources}`, {
                    signal: controller.signal,
                });
                if (!res.ok) {
                    throw new Error(res.status === 429 ? "Search is rate limited. Try again shortly." : "Search failed.");
                }
                const data = (await res.json()) as SearchResponse;
                setResults(data.results || []);
                setErrors(data.errors || []);
                cacheRef.current.set(key, {
                    timestamp: now,
                    results: data.results || [],
                    errors: data.errors || [],
                });
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                setResults([]);
                setErrors([err instanceof Error ? err.message : "Search failed."]);
            } finally {
                setLoading(false);
            }
        }, 450);

        return () => clearTimeout(handle);
    }, [query, selectedSources, isOpen]);

    const filteredResults = useMemo(() => {
        return results.filter((result) => selectedTypes.includes(result.type) && selectedSources.includes(result.source));
    }, [results, selectedTypes, selectedSources]);

    const toggleSource = (source: SourceKey) => {
        setSelectedSources((prev) =>
            prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]
        );
    };

    const toggleType = (type: MediaType) => {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Search everything"
            className="max-w-4xl bg-neutral-900/60"
        >
            <div className="space-y-5">
                <div className="flex flex-col gap-3">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search movies, TV shows, anime..."
                        className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                    />
                    <div className="flex flex-wrap gap-2">
                        {(["tmdb", "omdb", "mal"] as SourceKey[]).map((source) => (
                            <button
                                key={source}
                                type="button"
                                onClick={() => toggleSource(source)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                    selectedSources.includes(source)
                                        ? "bg-white text-neutral-950 border-transparent"
                                        : "bg-neutral-800/50 text-neutral-300 border-white/10 hover:bg-neutral-800"
                                )}
                            >
                                {sourceLabels[source]}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(["movie", "series", "anime"] as MediaType[]).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => toggleType(type)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                                    selectedTypes.includes(type)
                                        ? "bg-white text-neutral-950 border-transparent"
                                        : "bg-neutral-800/50 text-neutral-300 border-white/10 hover:bg-neutral-800"
                                )}
                            >
                                {typeLabels[type]}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && <div className="text-sm text-neutral-400">Searching...</div>}
                {!loading && query.trim().length >= 2 && filteredResults.length === 0 && errors.length === 0 && (
                    <div className="text-sm text-neutral-400">No results found.</div>
                )}
                {errors.length > 0 && (
                    <div className="space-y-2">
                        {errors.map((err, index) => (
                            <div key={`${err}-${index}`} className="text-sm text-red-400">
                                {err}
                            </div>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredResults.map((result) => (
                        <div key={`${result.source}-${result.id}`} className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                            <div className="flex gap-3">
                                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-800/50">
                                    {result.image ? (
                                        <Image
                                            src={result.image}
                                            alt={result.title}
                                            width={48}
                                            height={64}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full bg-neutral-800/50" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{result.title}</div>
                                    <div className="text-xs text-neutral-400 mt-1">
                                        {result.year ? `${result.year} • ` : ""}
                                        {typeLabels[result.type]} • {sourceLabels[result.source]}
                                    </div>
                                    {result.overview && (
                                        <div className="text-xs text-neutral-500 mt-2 max-h-10 overflow-hidden">
                                            {result.overview}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
