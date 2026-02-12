"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { LoggableMedia } from "@/components/entry/log-entry-modal";

type MediaType = "movie" | "series" | "anime" | "manga" | "game";

export type SearchResult = {
    id: string;
    title: string;
    image: string | null;
    year?: string;
    type: MediaType;
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
    onOpenLogModal?: (item: LoggableMedia) => void;
}

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

export function SearchModal({ isOpen, onClose, onOpenLogModal }: SearchModalProps) {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<MediaType>("movie");
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
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

    const getResultKey = (result: SearchResult) => `${result.type}-${result.id}`;

    const handleResultActivate = (result: SearchResult) => {
        if (actionLoading[getResultKey(result)]) return;
        handleResultClick(result);
    };

    const fetchMetadata = async (result: SearchResult): Promise<LoggableMedia> => {
        const fallback: LoggableMedia = {
            id: result.id,
            title: result.title,
            image: result.image,
            year: result.year,
            releaseYear: result.year,
            type: result.type,
            description: result.overview || "",
            imdbRating: result.rating ?? null,
            rating: result.rating ?? null,
        };

        try {
            const params = new URLSearchParams({
                type: result.type,
                id: String(result.id),
                title: result.title,
            });
            if (result.year) params.set("year", result.year);
            const res = await fetch(`/api/metadata?${params.toString()}`);
            if (!res.ok) return fallback;
            const payload = (await res.json()) as {
                data?: {
                    title?: string;
                    description?: string;
                    year?: string;
                    type?: MediaType;
                    image?: string | null;
                    rating?: number | null;
                    lengthMinutes?: number | null;
                    episodeCount?: number | null;
                    chapterCount?: number | null;
                    genresThemes?: string[];
                } | null;
            };
            const data = payload.data || null;
            if (!data) return fallback;

            return {
                ...fallback,
                title: data.title || fallback.title,
                image: data.image ?? fallback.image,
                year: data.year ?? fallback.year,
                releaseYear: data.year ?? fallback.releaseYear,
                type: data.type || fallback.type,
                description: data.description || fallback.description,
                imdbRating: data.rating ?? fallback.imdbRating,
                rating: data.rating ?? fallback.rating,
                lengthMinutes: data.lengthMinutes ?? null,
                episodeCount: data.episodeCount ?? null,
                chapterCount: data.chapterCount ?? null,
                genresThemes: data.genresThemes ?? [],
            };
        } catch {
            return fallback;
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        if (!onOpenLogModal) return;
        const key = getResultKey(result);
        setActionLoading((prev) => ({ ...prev, [key]: true }));
        try {
            const enriched = await fetchMetadata(result);
            onClose(); // Close search modal first
            onOpenLogModal(enriched);
        } finally {
            setActionLoading((prev) => ({ ...prev, [key]: false }));
        }
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
                        <div
                            key={`${result.type}-${result.id}`}
                            role="button"
                            tabIndex={actionLoading[getResultKey(result)] ? -1 : 0}
                            aria-disabled={actionLoading[getResultKey(result)]}
                            onClick={() => handleResultActivate(result)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleResultActivate(result);
                                }
                            }}
                            className={cn(
                                "w-full text-left rounded-2xl border border-white/5 bg-neutral-900/40 p-4 transition-colors hover:bg-neutral-900/60 disabled:opacity-50 disabled:cursor-not-allowed",
                                actionLoading[getResultKey(result)] && "cursor-not-allowed"
                            )}
                        >
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
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-white truncate">{result.title}</div>
                                    <div className="text-xs text-neutral-500">
                                        {result.year ? `${result.year} • ` : ""}
                                        {typeLabels[result.type]}
                                    </div>
                                    {result.overview && <ExpandableText text={result.overview} />}
                                </div>
                                {actionLoading[getResultKey(result)] && (
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
