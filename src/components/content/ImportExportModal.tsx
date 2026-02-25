"use client";

import { useEffect, useState } from "react";
import {
    Timestamp,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { Upload, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { InfographicToast } from "@/components/ui/InfographicToast";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

type EntryMediaType = "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
type EntryStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" | "unspecified";

type EntryExportRow = {
    title: string;
    mediaType: EntryMediaType;
    status: EntryStatus;
    userRating: number | null;
    imdbRating: number | null;
    lengthMinutes: number | null;
    episodeCount: number | null;
    chapterCount: number | null;
    genresThemes: string[];
    description: string;
    releaseYear: string | null;
    image: string | null;
    completedAt: number | null;
    createdAt: number | null;
};

const escapeCsv = (value: string) => {
    const normalized = value.replace(/"/g, '""');
    if (normalized.includes(",") || normalized.includes("\n") || normalized.includes('"')) {
        return `"${normalized}"`;
    }
    return normalized;
};

const parseCsv = (text: string) => {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === "," && !inQuotes) {
            current.push(field);
            field = "";
            continue;
        }
        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") i += 1;
            current.push(field);
            field = "";
            if (current.length > 1 || current[0]?.trim()) rows.push(current);
            current = [];
            continue;
        }
        field += char;
    }
    current.push(field);
    if (current.length > 1 || current[0]?.trim()) rows.push(current);
    return rows;
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const parseYearValue = (value: string | null | undefined) => {
    if (!value) return null;
    const match = value.match(/\d{4}/);
    if (!match) return null;
    const year = Number(match[0]);
    const maxYear = new Date().getFullYear() + 1;
    if (Number.isNaN(year) || year < 1888 || year > maxYear) return null;
    return match[0];
};

const parseRatingValue = (value: string | null | undefined, min: number, max: number) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
    return parsed;
};

const mapImdbType = (value: string): EntryMediaType => {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("tv") || normalized.includes("series")) return "series";
    if (normalized.includes("video game") || normalized.includes("game")) return "game";
    if (normalized.includes("anime")) return "anime";
    if (normalized.includes("manga")) return "manga";
    return "movie";
};

const formatDate = (millis: number | null) => {
    if (!millis) return "";
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

export function ImportExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importInfo, setImportInfo] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
    const [duplicateToast, setDuplicateToast] = useState<{ id: number; message: string } | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setImportFile(null);
        setImportError(null);
        setImportInfo(null);
        setImportProgress(null);
        setDuplicateToast(null);
    }, [isOpen]);

    const handleExport = async () => {
        if (!user) return;
        setIsExporting(true);
        setImportError(null);
        setImportInfo(null);
        try {
            const snapshot = await getDocs(
                query(collection(db, "users", user.uid, "entries"), orderBy("createdAt", "desc"))
            );
            const rows: EntryExportRow[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as Record<string, unknown>;
                const releaseYearRaw = data.releaseYear ?? data.year ?? null;
                const userRating =
                    typeof data.userRating === "number"
                        ? data.userRating
                        : typeof data.rating === "number"
                            ? data.rating
                            : null;
                rows.push({
                    title: String(data.title || ""),
                    mediaType: data.mediaType as EntryMediaType,
                    status: data.status as EntryStatus,
                    userRating,
                    imdbRating: typeof data.imdbRating === "number" ? data.imdbRating : null,
                    lengthMinutes: typeof data.lengthMinutes === "number" ? data.lengthMinutes : null,
                    episodeCount: typeof data.episodeCount === "number" ? data.episodeCount : null,
                    chapterCount: typeof data.chapterCount === "number" ? data.chapterCount : null,
                    genresThemes: Array.isArray(data.genresThemes) ? (data.genresThemes as string[]) : [],
                    description: String(data.description || ""),
                    releaseYear: releaseYearRaw ? String(releaseYearRaw) : null,
                    image: typeof data.image === "string" ? data.image : null,
                    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toMillis() : null,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : null,
                });
            });
            const headers = [
                "Title",
                "Media Type",
                "Status",
                "Release Year",
                "Your Rating",
                "IMDb Rating",
                "Image",
                "Length (mins)",
                "Episodes",
                "Chapters",
                "Genres",
                "Description",
                "Completed At",
                "Created At",
            ];
            const lines = [headers.join(",")];
            rows.forEach((row) => {
                lines.push(
                    [
                        escapeCsv(row.title),
                        escapeCsv(row.mediaType),
                        escapeCsv(row.status),
                        escapeCsv(row.releaseYear || ""),
                        escapeCsv(row.userRating !== null ? String(row.userRating) : ""),
                        escapeCsv(row.imdbRating !== null ? String(row.imdbRating) : ""),
                        escapeCsv(row.image || ""),
                        escapeCsv(row.lengthMinutes !== null ? String(row.lengthMinutes) : ""),
                        escapeCsv(row.episodeCount !== null ? String(row.episodeCount) : ""),
                        escapeCsv(row.chapterCount !== null ? String(row.chapterCount) : ""),
                        escapeCsv(row.genresThemes.join(", ")),
                        escapeCsv(row.description),
                        escapeCsv(formatDate(row.completedAt)),
                        escapeCsv(formatDate(row.createdAt)),
                    ].join(",")
                );
            });
            const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "plotline-export.csv";
            anchor.click();
            URL.revokeObjectURL(url);
            setImportInfo("Export ready.");
        } catch (err) {
            setImportError(err instanceof Error ? err.message : "Failed to export.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        if (!user || !importFile) return;
        setIsImporting(true);
        setImportError(null);
        setImportInfo(null);
        setImportProgress(null);
        try {
            const text = await importFile.text();
            const rows = parseCsv(text);
            if (rows.length < 2) {
                setImportError("CSV file appears to be empty.");
                return;
            }
            const headerRow = rows[0].map(normalizeHeader);
            const headerIndex = new Map(headerRow.map((value, index) => [value, index]));
            const titleIndex = headerIndex.get("title");
            if (titleIndex === undefined) {
                setImportError("CSV is missing a Title column.");
                return;
            }
            const typeIndex = headerIndex.get("title type");
            const releaseYearIndex = headerIndex.get("release year") ?? headerIndex.get("year");
            const runtimeIndex = headerIndex.get("runtime (mins)") ?? headerIndex.get("runtime");
            const genresIndex = headerIndex.get("genres");
            const imdbRatingIndex = headerIndex.get("imdb rating") ?? headerIndex.get("imdb");
            const yourRatingIndex = headerIndex.get("your rating") ?? headerIndex.get("rating");
            const imageIndex =
                headerIndex.get("image") ??
                headerIndex.get("image url") ??
                headerIndex.get("poster") ??
                headerIndex.get("poster url") ??
                headerIndex.get("poster_url");

            type MetadataCache = {
                image?: string | null;
                description?: string;
                year?: string;
                imdbRating?: number | null;
                lengthMinutes?: number | null;
                episodeCount?: number | null;
                chapterCount?: number | null;
                genresThemes?: string[];
            };

            const metadataCache = new Map<string, MetadataCache | null>();
            let lastFetchAt = 0;
            let windowResetAt = Date.now() + 60000;
            let windowCount = 0;
            const minIntervalMs = 350;
            const maxPerWindow = 50;

            const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

            const fetchFullMetadata = async (title: string, year: string | null, mediaType: EntryMediaType) => {
                if (mediaType !== "movie" && mediaType !== "series") return null;
                const key = `${mediaType}|${title}|${year || ""}`.toLowerCase();
                if (metadataCache.has(key)) return metadataCache.get(key) ?? null;
                const now = Date.now();
                if (now > windowResetAt) {
                    windowResetAt = now + 60000;
                    windowCount = 0;
                }
                if (windowCount >= maxPerWindow) {
                    const waitMs = Math.max(0, windowResetAt - now);
                    if (waitMs > 0) await wait(waitMs);
                    windowResetAt = Date.now() + 60000;
                    windowCount = 0;
                }
                const delta = now - lastFetchAt;
                if (delta < minIntervalMs) await wait(minIntervalMs - delta);
                lastFetchAt = Date.now();
                windowCount += 1;
                try {
                    const params = new URLSearchParams({ title, type: mediaType });
                    if (year) params.set("year", year);
                    const res = await fetch(`/api/metadata?${params.toString()}`);
                    if (!res.ok) {
                        metadataCache.set(key, null);
                        return null;
                    }
                    const payload = (await res.json()) as { data?: MetadataCache | null };
                    const data = payload?.data ?? null;
                    metadataCache.set(key, data);
                    return data;
                } catch {
                    metadataCache.set(key, null);
                    return null;
                }
            };

            const existingEntriesSnapshot = await getDocs(
                query(collection(db, "users", user.uid, "entries"), limit(1000)),
            );

            const existingLibrary: { title: string; mediaType: string; year: string }[] = [];
            existingEntriesSnapshot.forEach((entryDoc) => {
                const raw = entryDoc.data() as Record<string, unknown>;
                existingLibrary.push({
                    title: typeof raw.title === "string" ? raw.title.trim().toLowerCase() : "",
                    mediaType: typeof raw.mediaType === "string" ? raw.mediaType : "movie",
                    year: typeof raw.releaseYear === "string"
                        ? raw.releaseYear
                        : typeof raw.year === "string"
                            ? raw.year
                            : "",
                });
            });

            let imported = 0;
            let skipped = 0;
            let duplicatesSkipped = 0;
            let batch = writeBatch(db);
            let batchCount = 0;

            setImportProgress({ current: 0, total: rows.length - 1 });

            for (let i = 1; i < rows.length; i += 1) {
                setImportProgress({ current: i, total: rows.length - 1 });
                const row = rows[i];
                const rawTitle = row[titleIndex] || "";
                const title = rawTitle.trim();
                if (!title) {
                    skipped += 1;
                    continue;
                }
                const typeValue = typeIndex !== undefined ? row[typeIndex] || "" : "";
                const releaseYearRaw = releaseYearIndex !== undefined ? row[releaseYearIndex]?.trim() : "";
                const runtimeValue = runtimeIndex !== undefined ? Number(row[runtimeIndex]) : null;
                const genresValue = genresIndex !== undefined ? row[genresIndex] || "" : "";
                const imdbRatingRaw = imdbRatingIndex !== undefined ? row[imdbRatingIndex] || "" : "";
                const yourRatingRaw = yourRatingIndex !== undefined ? row[yourRatingIndex] || "" : "";
                const releaseYearValue = parseYearValue(releaseYearRaw);
                const imdbRatingValue = parseRatingValue(imdbRatingRaw, 0, 10);
                const userRatingValue = parseRatingValue(yourRatingRaw, 1, 10);
                const mediaType = mapImdbType(typeValue);
                const imageRaw = imageIndex !== undefined ? row[imageIndex] || "" : "";

                const metadata = await fetchFullMetadata(title, releaseYearValue, mediaType);

                const finalImage = imageRaw && imageRaw.trim() ? imageRaw.trim() : (metadata?.image ?? null);
                const finalDescription = metadata?.description ?? "";
                const finalReleaseYear = releaseYearValue || metadata?.year || null;
                const finalLengthMinutes = Number.isFinite(runtimeValue as number) ? runtimeValue : (metadata?.lengthMinutes ?? null);
                const finalImdbRating = imdbRatingValue ?? metadata?.imdbRating ?? null;
                const finalGenres = genresValue
                    ? genresValue.split(",").map((g: string) => g.trim()).filter(Boolean)
                    : (metadata?.genresThemes ?? []);

                const rating = userRatingValue ?? finalImdbRating ?? null;
                const status: EntryStatus = "unspecified";
                const completionDateUnknown = false;
                const completedAt = null;
                const titleLower = title.trim().toLowerCase();
                const duplicateExists = existingLibrary.some((e) => {
                    if (e.mediaType !== mediaType) return false;
                    if (e.title !== titleLower) return false;
                    if (e.year && finalReleaseYear && e.year !== finalReleaseYear) return false;
                    return true;
                });

                if (duplicateExists) {
                    skipped += 1;
                    duplicatesSkipped += 1;
                    continue;
                }

                existingLibrary.push({
                    title: titleLower,
                    mediaType,
                    year: finalReleaseYear || "",
                });

                const entryRef = doc(collection(db, "users", user.uid, "entries"));
                batch.set(entryRef, {
                    title,
                    mediaType,
                    status,
                    userRating: userRatingValue,
                    imdbRating: finalImdbRating,
                    rating,
                    lengthMinutes: finalLengthMinutes,
                    episodeCount: metadata?.episodeCount ?? null,
                    chapterCount: metadata?.chapterCount ?? null,
                    genresThemes: finalGenres,
                    description: finalDescription,
                    notes: "",
                    externalId: null,
                    image: finalImage,
                    releaseYear: finalReleaseYear,
                    year: finalReleaseYear,
                    completedAt,
                    completionDateUnknown,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                batchCount += 1;
                imported += 1;

                if (batchCount >= 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            setImportInfo(
                duplicatesSkipped > 0
                    ? `Imported ${imported} items. Skipped ${skipped} (${duplicatesSkipped} duplicates).`
                    : `Imported ${imported} items. Skipped ${skipped}.`,
            );
            if (duplicatesSkipped > 0) {
                setDuplicateToast({
                    id: Date.now(),
                    message: `${duplicatesSkipped} item${duplicatesSkipped > 1 ? "s were" : " was"} skipped because it already exists.`,
                });
            }
        } catch (err) {
            setImportError(err instanceof Error ? err.message : "Failed to import.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import & Export" className="max-w-3xl bg-neutral-900/60">
            <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-white">Import IMDB CSV</div>
                            <div className="mt-1 text-xs text-neutral-500">
                                Upload your IMDB list export to bring items into Plotline.
                            </div>
                        </div>
                        <Upload size={20} className="text-neutral-500" suppressHydrationWarning />
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto flex-1">
                        <div className="flex gap-3 sm:items-center">
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) => {
                                    setImportFile(event.target.files?.[0] || null);
                                    setImportError(null);
                                    setImportInfo(null);
                                    setImportProgress(null);
                                }}
                                className="w-full rounded-xl border border-white/5 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-700 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
                            />
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={!importFile || isImporting}
                                className={cn(
                                    "rounded-full bg-neutral-100/90 px-5 py-2 text-xs font-semibold text-neutral-950 transition-all hover:bg-neutral-100 min-w-[100px] flex items-center justify-center gap-2",
                                    !importFile || isImporting ? "cursor-not-allowed opacity-70" : ""
                                )}
                            >
                                {isImporting ? (
                                    <>
                                        <span>Importing</span>
                                        <span className="flex gap-0.5">
                                            <span className="h-1 w-1 rounded-full bg-neutral-950 animate-[bounce_1s_infinite_0ms]"></span>
                                            <span className="h-1 w-1 rounded-full bg-neutral-950 animate-[bounce_1s_infinite_200ms]"></span>
                                            <span className="h-1 w-1 rounded-full bg-neutral-950 animate-[bounce_1s_infinite_400ms]"></span>
                                        </span>
                                    </>
                                ) : (
                                    "Import"
                                )}
                            </button>
                        </div>
                        {isImporting && importProgress ? (
                            <div className="space-y-1 pt-1">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                                    <div
                                        className="h-full bg-neutral-200 transition-all duration-300 ease-out"
                                        style={{
                                            width: `${(importProgress.current / importProgress.total) * 100}%`,
                                        }}
                                    />
                                </div>
                                <div className="text-[10px] text-neutral-500 text-right">
                                    {importProgress.current} / {importProgress.total} items
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-white">Export to CSV</div>
                            <div className="mt-1 text-xs text-neutral-500">Download a CSV of your current items.</div>
                        </div>
                        <Download size={20} className="text-neutral-500" suppressHydrationWarning />
                    </div>
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={isExporting}
                            className={cn(
                                "rounded-full border border-white/10 bg-neutral-800/50 px-5 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                                isExporting ? "cursor-not-allowed opacity-70" : ""
                            )}
                        >
                            {isExporting ? "Preparing..." : "Download CSV"}
                        </button>
                    </div>
                </div>
                {importError && <div className="text-sm text-red-400">{importError}</div>}
                {importInfo && <div className="text-sm text-emerald-300">{importInfo}</div>}
            </div>
            <InfographicToast
                isOpen={Boolean(duplicateToast)}
                title="Duplicate Detected"
                message={duplicateToast?.message || ""}
                onClose={() => setDuplicateToast(null)}
            />
        </Modal>
    );
}
