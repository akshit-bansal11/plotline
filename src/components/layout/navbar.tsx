"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "motion/react";
import {
    Search,
    LogOut,
    List,
    Settings,
    Upload,
    Download,
    LogIn,
    UserCircle,
    KeyRound,
    Plus,
    ListPlus,
} from "lucide-react";
import {
    Timestamp,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { cn } from "@/lib/utils";
import { NavLinks } from "./nav-links";
import { MobileMenu } from "./mobile-menu";
import { AuthModal } from "@/components/auth/auth-modal";
import { LogEntryModal, type LoggableMedia } from "@/components/entry/log-entry-modal";
import { MyListsModal } from "@/components/lists/my-lists-modal";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/auth-context";
import { useSection } from "@/context/section-context";
import { db, storage } from "@/lib/firebase";
import { GlobalSearch } from "@/components/search/global-search";
import { useData } from "@/context/data-context";
import { NewListModal } from "@/components/lists/new-list-modal";

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

const parseImdbDate = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
};

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

const MenuItem = ({
    label,
    onClick,
    icon: Icon,
    buttonRef,
}: {
    label: string;
    onClick: () => void;
    icon: typeof UserCircle;
    buttonRef?: (node: HTMLButtonElement | null) => void;
}) => (
    <button
        type="button"
        role="menuitem"
        onClick={onClick}
        ref={buttonRef}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
        <Icon size={16} className="text-neutral-400" suppressHydrationWarning />
        <span>{label}</span>
    </button>
);

function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
                const extension = selectedFile.name.split(".").pop() || "png";
                const uploadRef = storageRef(storage, `users/${user.uid}/profile-${Date.now()}.${extension}`);
                await uploadBytes(uploadRef, selectedFile);
                nextPhoto = await getDownloadURL(uploadRef);
            }
            await updateUserProfile(trimmed, nextPhoto);
            setInfo("Profile updated.");
            setSelectedFile(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const displayPhoto = removePhoto ? null : previewUrl || user?.photoURL || null;
    const initials = (displayName.trim() || user?.email || "U").slice(0, 1).toUpperCase();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Profile" className="max-w-2xl bg-neutral-900/60">
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col gap-6 sm:flex-row">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-neutral-900/40">
                            {displayPhoto ? (
                                <Image src={displayPhoto} alt="Profile" width={96} height={96} className="h-full w-full object-cover" />
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
                        <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Live preview</div>
                            <div className="mt-3 flex items-center gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-neutral-900/40">
                                    {displayPhoto ? (
                                        <Image src={displayPhoto} alt="Preview" width={48} height={48} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-neutral-400">
                                            {initials}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">{displayName.trim() || "Your name"}</div>
                                    <div className="text-xs text-neutral-500">{user?.email || ""}</div>
                                </div>
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
                        isSaving ? "cursor-not-allowed opacity-70" : ""
                    )}
                >
                    {isSaving ? "Saving..." : "Save changes"}
                </button>
            </form>
        </Modal>
    );
}

function ImportExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importInfo, setImportInfo] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setImportFile(null);
        setImportError(null);
        setImportInfo(null);
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
            const dateRatedIndex = headerIndex.get("date rated");
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

            let imported = 0;
            let skipped = 0;
            let batch = writeBatch(db);
            let batchCount = 0;

            for (let i = 1; i < rows.length; i += 1) {
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
                const dateRatedValue = dateRatedIndex !== undefined ? row[dateRatedIndex] || "" : "";
                const parsedDate = parseImdbDate(dateRatedValue);
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
            setImportInfo(`Imported ${imported} items. Skipped ${skipped}.`);
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
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) => {
                                setImportFile(event.target.files?.[0] || null);
                                setImportError(null);
                                setImportInfo(null);
                            }}
                            className="w-full rounded-xl border border-white/5 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-700 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
                        />
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={!importFile || isImporting}
                            className={cn(
                                "rounded-full bg-neutral-100/90 px-5 py-2 text-xs font-semibold text-neutral-950 transition-all hover:bg-neutral-100",
                                !importFile || isImporting ? "cursor-not-allowed opacity-70" : ""
                            )}
                        >
                            {isImporting ? "Importing..." : "Import"}
                        </button>
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
        </Modal>
    );
}

function SettingsModal({ isOpen, onClose, onSignOut }: { isOpen: boolean; onClose: () => void; onSignOut: () => void }) {
    const { user, sendPasswordReset } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const canChangePassword = Boolean(user?.providerData?.some((provider) => provider.providerId === "password"));

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
            setError(err instanceof Error ? err.message : "Failed to send reset email.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" className="max-w-xl bg-neutral-900/60">
            <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-sm font-semibold text-white">Account</div>
                            <div className="mt-1 text-xs text-neutral-500">Manage your account access.</div>
                        </div>
                        <Settings size={20} className="text-neutral-500" suppressHydrationWarning />
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                        {canChangePassword ? (
                            <button
                                type="button"
                                onClick={handlePasswordReset}
                                disabled={isSending}
                                className={cn(
                                    "flex items-center justify-between rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-3 text-left text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800",
                                    isSending ? "cursor-not-allowed opacity-70" : ""
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <KeyRound size={16} className="text-neutral-400" suppressHydrationWarning />
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
                                <LogOut size={16} className="text-neutral-400" suppressHydrationWarning />
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

export function Navbar() {
    const { scrollY } = useScroll();
    const { activeSection } = useSection();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isMyListsOpen, setIsMyListsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [isNewListOpen, setIsNewListOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isImportExportOpen, setIsImportExportOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [pendingItem, setPendingItem] = useState<LoggableMedia | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    // Map section to media type for filtering lists
    const getMediaTypeFromSection = () => {
        switch (activeSection) {
            case "movies": return "movie";
            case "series": return "series";
            case "anime": return "anime";
            case "manga": return "manga";
            case "games": return "game";
            default: return null;
        }
    };
    const { user, signOut } = useAuth();
    const userLabel = user?.displayName || user?.email;
    const avatarUrl = user?.photoURL || null;

    const handleLogFromSearch = (item: LoggableMedia) => {
        if (!user) {
            setIsAuthOpen(true);
            return;
        }
        setPendingItem(item);
        setIsSearchOpen(false);
        setIsLogOpen(true);
    };

    const handleSignOut = async () => {
        await signOut();
        setIsSettingsOpen(false);
        setIsProfileMenuOpen(false);
    };

    const menuItems = useMemo(
        () => [
            {
                label: "Profile",
                icon: UserCircle,
                onClick: () => {
                    setIsProfileOpen(true);
                    setIsProfileMenuOpen(false);
                },
            },
            {
                label: "My Lists",
                icon: List,
                onClick: () => {
                    setIsMyListsOpen(true);
                    setIsProfileMenuOpen(false);
                },
            },
            {
                label: "Import/Export",
                icon: Upload,
                onClick: () => {
                    setIsImportExportOpen(true);
                    setIsProfileMenuOpen(false);
                },
            },
            {
                label: "Settings",
                icon: Settings,
                onClick: () => {
                    setIsSettingsOpen(true);
                    setIsProfileMenuOpen(false);
                },
            },
        ],
        []
    );

    useEffect(() => {
        if (!isProfileMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            setIsProfileMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isProfileMenuOpen]);

    useEffect(() => {
        if (!isProfileMenuOpen) return;
        const first = menuItemRefs.current[0];
        if (first) first.focus();
    }, [isProfileMenuOpen]);

    const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsProfileMenuOpen(true);
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsProfileMenuOpen((prev) => !prev);
        }
        if (event.key === "Escape") {
            setIsProfileMenuOpen(false);
        }
    };

    const handleMenuKeyDown = (event: React.KeyboardEvent) => {
        const items = menuItemRefs.current.filter(Boolean) as HTMLButtonElement[];
        if (!items.length) return;
        const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length;
            items[nextIndex]?.focus();
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            items[prevIndex]?.focus();
        }
        if (event.key === "Home") {
            event.preventDefault();
            items[0]?.focus();
        }
        if (event.key === "End") {
            event.preventDefault();
            items[items.length - 1]?.focus();
        }
        if (event.key === "Escape") {
            event.preventDefault();
            setIsProfileMenuOpen(false);
            triggerRef.current?.focus();
        }
    };

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = lastScrollY;
        setLastScrollY(latest);

        // Show background when scrolled
        if (latest > 50) {
            setIsScrolled(true);
        } else {
            setIsScrolled(false);
        }

        // Hide navbar when scrolling down, show when scrolling up
        if (latest > previous && latest > 150) {
            setIsHidden(true);
        } else {
            setIsHidden(false);
        }
    });

    return (
        <>
            <motion.header
                variants={{
                    visible: { y: 0 },
                    hidden: { y: "-100%" },
                }}
                animate={isHidden ? "hidden" : "visible"}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className={cn(
                    "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
                    isScrolled
                        ? "backdrop-blur-xl bg-neutral-950/50 py-3"
                        : "bg-transparent py-5"
                )}
            >
                <div className="container mx-auto flex items-center justify-between px-4 md:px-6">
                    <Link
                        href="/"
                        className="relative z-50 text-3xl font-bold tracking-tight text-white"
                    >
                        Plotline<span className="text-neutral-600">.</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:block">
                            <NavLinks />
                        </div>

                        {user && (
                            <div className="hidden md:flex items-center gap-2">
                                <GlobalSearch />
                                <button
                                    onClick={() => {
                                        setPendingItem(null);
                                        setIsLogOpen(true);
                                    }}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60"
                                >
                                    <Plus size={14} suppressHydrationWarning />
                                    Log entry
                                </button>
                                <button
                                    onClick={() => setIsNewListOpen(true)}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/40 px-3 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60"
                                >
                                    <ListPlus size={14} suppressHydrationWarning />
                                    New list
                                </button>
                            </div>
                        )}

                        {userLabel ? (
                            <div className="relative hidden md:flex items-center">
                                <button
                                    ref={triggerRef}
                                    type="button"
                                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                    onKeyDown={handleTriggerKeyDown}
                                    aria-haspopup="menu"
                                    aria-expanded={isProfileMenuOpen}
                                    aria-label={userLabel || "Profile"}
                                    className="flex items-center rounded-full border border-white/10 bg-neutral-900/40 p-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-900/60"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-900/50 text-xs font-semibold text-neutral-300">
                                        {avatarUrl ? (
                                            <Image src={avatarUrl} alt={userLabel || "User"} width={32} height={32} className="h-full w-full object-cover" />
                                        ) : (
                                            (userLabel || "U").slice(0, 1).toUpperCase()
                                        )}
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {isProfileMenuOpen && (
                                        <motion.div
                                            ref={menuRef}
                                            role="menu"
                                            onKeyDown={handleMenuKeyDown}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 6 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                                        >
                                            <div className="space-y-1">
                                                {menuItems.map((item, index) => (
                                                    <MenuItem
                                                        key={item.label}
                                                        label={item.label}
                                                        icon={item.icon}
                                                        onClick={item.onClick}
                                                        buttonRef={(node) => {
                                                            menuItemRefs.current[index] = node;
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAuthOpen(true)}
                                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <LogIn size={16} suppressHydrationWarning />
                                <span>Sign In</span>
                            </button>
                        )}

                        <MobileMenu
                            onAuthOpen={() => setIsAuthOpen(true)}
                            onSearchOpen={() => {
                                setPendingItem(null);
                                setIsLogOpen(true);
                            }}
                            onListsOpen={() => setIsMyListsOpen(true)}
                            onProfileOpen={() => setIsProfileOpen(true)}
                            onImportExportOpen={() => setIsImportExportOpen(true)}
                            onSettingsOpen={() => setIsSettingsOpen(true)}
                            userLabel={userLabel}
                        />
                    </div>
                </div>
            </motion.header>

            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
            <LogEntryModal
                isOpen={isLogOpen}
                onClose={() => {
                    setIsLogOpen(false);
                    setPendingItem(null);
                }}
                initialMedia={pendingItem}
            />
            <MyListsModal
                isOpen={isMyListsOpen}
                onClose={() => {
                    setIsMyListsOpen(false);
                    setPendingItem(null);
                }}
                initialItem={pendingItem}
                mediaType={getMediaTypeFromSection()}
            />
            <NewListModal
                isOpen={isNewListOpen}
                onClose={() => setIsNewListOpen(false)}
                defaultType={getMediaTypeFromSection()}
            />
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
            <ImportExportModal isOpen={isImportExportOpen} onClose={() => setIsImportExportOpen(false)} />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSignOut={handleSignOut} />
        </>
    );
}
