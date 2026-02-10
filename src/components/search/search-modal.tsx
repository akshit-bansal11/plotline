"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type SourceKey = "tmdb" | "omdb" | "mal";
type MediaType = "movie" | "series" | "anime" | "manga" | "game";

export type SearchResult = {
    id: string | number;
    title: string;
    image: string | null;
    year?: string;
    type: MediaType;
    source: SourceKey;
    overview?: string;
    rating?: number | null;
};

interface SearchResponse {
    results: SearchResult[];
    errors?: string[];
    cached?: boolean;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLog?: (item: SearchResult) => void;
    onAddToList?: (item: SearchResult) => void;
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
    manga: "Manga",
    game: "Game",
};

function ExpandableText({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 150;

    return (
        <div className="mt-2">
            <div className={cn("text-xs text-neutral-500", !expanded && isLong && "line-clamp-2")}>
                {text}
            </div>
            {isLong && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 hover:text-white"
                >
                    {expanded ? "Show less" : "Show more"}
                </button>
            )}
        </div>
    );
}

export function SearchModal({ isOpen, onClose, onLog, onAddToList }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<MediaType>("movie");
    const cacheRef = useRef<Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>>(new Map());
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setQuery("");
            setResults([]);
            setErrors([]);
        }
    }, [isOpen]);

    const runSearch = async (queryValue: string, typeValue: MediaType) => {
        const key = `${queryValue.trim().toLowerCase()}|${typeValue}`;
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
            const res = await fetch(`/api/search?q=${encodeURIComponent(queryValue.trim())}&type=${typeValue}`, {
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
    };

    useEffect(() => {
        if (!isOpen) return;
        if (query.trim().length < 2) {
            setResults([]);
            setErrors([]);
            return;
        }

        const handle = setTimeout(async () => {
            await runSearch(query, selectedType);
        }, 450);

        return () => clearTimeout(handle);
    }, [query, selectedType, isOpen]);

    const filteredResults = useMemo(() => {
        return results.filter((result) => result.type === selectedType);
    }, [results, selectedType]);

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
                        onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const trimmed = query.trim();
                            if (trimmed.length < 2) return;
                            void runSearch(trimmed, selectedType);
                        }}
                        placeholder="Search movies, series, anime, manga, games..."
                        className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                    <div className="flex flex-wrap gap-2">
                        {(["movie", "series", "anime", "manga", "game"] as MediaType[]).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setSelectedType(type)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium border transition-all",
                                    selectedType === type
                                        ? "bg-neutral-100/70 backdrop-blur-sm text-neutral-950 border-transparent shadow-[0_0_15px_rgba(255,255,255,0.05)]"
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

                <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
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
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onLog?.(result)}
                                            disabled={!onLog}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                                onLog
                                                    ? "border-white/10 bg-neutral-800/40 text-neutral-200 hover:bg-neutral-800 hover:text-white"
                                                    : "border-white/5 bg-neutral-900/40 text-neutral-600 cursor-not-allowed"
                                            )}
                                        >
                                            Log
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onAddToList?.(result)}
                                            disabled={!onAddToList}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                                onAddToList
                                                    ? "border-white/10 bg-neutral-800/40 text-neutral-200 hover:bg-neutral-800 hover:text-white"
                                                    : "border-white/5 bg-neutral-900/40 text-neutral-600 cursor-not-allowed"
                                            )}
                                        >
                                            Add to list
                                        </button>
                                    </div>
                                    {result.overview && <ExpandableText text={result.overview} />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
