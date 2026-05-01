// File: src/components/log-entry/LogEntryMetadata.tsx
// Purpose: Metadata display and editing section for log entries

import { RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef } from "react";
import { cn, entryMediaTypeLabels } from "@/utils";
import type { EntryMediaType } from "../../types/log-entry";
import { InlineEditable } from "./InlineEditable";

interface LogEntryMetadataProps {
  readonly mediaType: EntryMediaType;
  readonly isMovie: boolean;
  readonly title: string;
  readonly image: string | null;
  readonly director: string;
  readonly producer: string;
  readonly cast: readonly string[];
  readonly releaseYear: string;
  readonly description: string;
  readonly isViewMode: boolean;
  readonly activeField: string | null;
  readonly setActiveField: (field: string | null) => void;
  readonly onTitleChange: (v: string) => void;
  readonly onDirectorChange: (v: string) => void;
  readonly onProducerChange: (v: string) => void;
  readonly onCastChange: (v: string[]) => void;
  readonly onReleaseYearChange: (v: string) => void;
  readonly onDescriptionChange: (v: string) => void;
  readonly isRefetching?: boolean;
  readonly onRefetch?: () => void;
  readonly refetchError?: string | null;
  readonly externalId?: string | null;
  readonly currentMode: "create" | "view" | "edit";
}

export function LogEntryMetadata({
  mediaType,
  isMovie,
  title = "",
  image = null,
  director,
  setDirector,
  producer,
  setProducer,
  imdbRating,
  setImdbRating,
  description,
  setDescription,
  tags,
  setTags,
  setIsMovie,
  cast = [],
  onCastChange,
  activeField,
  setActiveField,
  isViewMode,
  releaseYear,
  onReleaseYearChange,
  onTitleChange,
  currentMode,
  externalId,
  onRefetch,
  isRefetching,
  refetchError,
}: LogEntryMetadataProps) {
  const castRef = useRef<HTMLInputElement>(null);

  const titleFontSize = useMemo(() => {
    const len = title?.length || 0;
    if (len <= 12) return "text-3xl";
    if (len <= 24) return "text-2xl";
    if (len <= 45) return "text-xl";
    return "text-lg";
  }, [title]);

  const creatorLabels = useMemo(() => {
    if (mediaType === "anime") return { field1: "DIRECTOR", field2: "STUDIO" };
    if (mediaType === "manga") return { field1: "WRITER", field2: "PUBLISHER" };
    if (mediaType === "game") return { field1: "DEVELOPER", field2: "PUBLISHER" };
    return { field1: "DIRECTED BY", field2: "PRODUCED BY" };
  }, [mediaType]);

  const castLabel = useMemo(() => {
    return mediaType === "movie" || mediaType === "series" ? "CAST" : "CHARACTERS";
  }, [mediaType]);

  const editableProps = { activeField, setActiveField, readOnly: isViewMode };

  if (isViewMode) {
    return (
      <div className="flex gap-5">
        <div className="relative h-64 aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 shadow-2xl border border-white/5">
          {image ? (
            <Image src={image} alt={title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Search className="w-6 h-6 text-white/10" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end min-w-0 flex-1 pb-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex flex-col min-w-0 items-start gap-3">
              <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] shrink-0">
                {entryMediaTypeLabels[mediaType] ?? mediaType}
              </span>
              <div
                className={cn(
                  "font-black leading-tight uppercase tracking-tight text-white pr-2",
                  titleFontSize,
                )}
              >
                {title}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                {creatorLabels.field1}
              </span>
              <span className="text-[13px] font-medium text-white/70">{director || "—"}</span>
            </div>

            {creatorLabels.field2 && (
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                  {creatorLabels.field2}
                </span>
                <span className="text-[13px] font-medium text-white/70">{producer || "—"}</span>
              </div>
            )}

            <div className="flex flex-col col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                GENRES & THEMES
              </span>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {tags && tags.length > 0 ? (
                  tags.map((t: string) => (
                    <span
                      key={t}
                      className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-white/5"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] font-medium text-white/70">—</span>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                IMDB RATING
              </span>
              <span className="text-[13px] font-medium text-white/70">{imdbRating || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[540px] shrink-0 border-r border-white/5 overflow-y-auto p-8 flex flex-col bg-[#111]">
      <div className="mb-6 flex justify-between items-center">
        <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-[0.15em]">
          {entryMediaTypeLabels[mediaType] ?? mediaType}
        </span>

        {currentMode !== "create" && externalId && (
          <div className="flex items-center gap-3">
            {refetchError && (
              <span className="text-[10px] font-mono text-red-400">{refetchError}</span>
            )}
            <button
              type="button"
              onClick={onRefetch}
              disabled={isRefetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-[10px] font-mono text-white/60 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
              {isRefetching ? "REFETCHING..." : "REFETCH"}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 mb-8">
        <div className="relative h-64 aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 shadow-2xl border border-white/5">
          {image ? (
            <Image src={image} alt={title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Search className="w-6 h-6 text-white/10" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end min-w-0 flex-1">
          <InlineEditable
            value={title}
            onCommit={onTitleChange}
            fieldId="left-title"
            {...editableProps}
            noTruncate
            className={cn(
              "font-black leading-tight uppercase tracking-tight text-white mb-3 pr-2",
              titleFontSize,
            )}
          />

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                  {creatorLabels.field1}
                </label>
                <input
                  type="text"
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  placeholder={`Enter ${creatorLabels.field1.toLowerCase()}...`}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                  {creatorLabels.field2}
                </label>
                <input
                  type="text"
                  value={producer}
                  onChange={(e) => setProducer(e.target.value)}
                  placeholder={`Enter ${creatorLabels.field2.toLowerCase()}...`}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">IMDb Rating</label>
                <input
                  type="text"
                  value={imdbRating}
                  onChange={(e) => setImdbRating(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Release Year</label>
                <input
                  type="text"
                  value={releaseYear}
                  onChange={(e) => onReleaseYearChange(e.target.value)}
                  placeholder="Year"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={6}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Genres & Themes</label>
              <div className="flex flex-wrap gap-2">
                {tags && tags.map((tag: string, idx: number) => (
                  <span 
                    key={tag + idx}
                    className="px-3 py-1 bg-zinc-900 text-zinc-400 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-zinc-800 flex items-center gap-2 group"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((_: any, i: number) => i !== idx))}
                      className="hover:text-red-400 transition-colors"
                    >
                      <Search className="w-3 h-3 rotate-45" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{castLabel}</label>
              <div className="flex flex-wrap gap-2">
                {cast && cast.map((person: string, idx: number) => (
                  <span 
                    key={person + idx}
                    className="px-3 py-1 bg-zinc-900 text-zinc-400 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-zinc-800 flex items-center gap-2"
                  >
                    {person}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveField("left-cast")}
                  className="px-3 py-1 bg-zinc-900/50 text-zinc-600 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-zinc-800 border-dashed hover:border-zinc-700 hover:text-zinc-500 transition-all"
                >
                  + EDIT
                </button>
              </div>
              {activeField === "left-cast" && (
                <div className="mt-2">
                  <input
                    ref={castRef}
                    autoFocus
                    placeholder="Comma-separated names..."
                    defaultValue={cast.join(", ")}
                    onBlur={(e) => {
                      onCastChange(
                        e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean)
                          .slice(0, 20),
                      );
                      setActiveField(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setActiveField(null);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
