// File: src/components/log-entry/LogEntryEditLeftPanel.tsx
// Purpose: Left panel of the log entry editor focusing on media metadata and basic information

"use client";

// ─── React
import React from "react";

// ─── Icons
import { Search, RefreshCw, X } from "lucide-react";

// ─── Internal — components
import { LogEntryMetadata } from "./LogEntryMetadata";

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

// ─── Internal — utils
import { cn } from "@/utils";

interface LogEntryEditLeftPanelProps {
  state: {
    title: string;
    setTitle: (val: string) => void;
    mediaType: EntryMediaType;
    setMediaType: (val: EntryMediaType) => void;
    isMovie: boolean;
    setIsMovie: (val: boolean) => void;
    image: string | null;
    setImage: (val: string | null) => void;
    description: string;
    setDescription: (val: string) => void;
    releaseYear: string;
    setReleaseYear: (val: string) => void;
    director: string;
    setDirector: (val: string) => void;
    producer: string;
    setProducer: (val: string) => void;
    tags: string[];
    setTags: (val: string[]) => void;
    imdbRating: string;
    setImdbRating: (val: string) => void;
    activeField: string | null;
    setActiveField: (val: string | null) => void;
    cast: string[];
    setCast: (val: string[]) => void;
    currentEpisodes: number;
    episodeCount: string;
    currentSeasons: number;
    totalSeasons: number;
    currentChapters: number;
    chapterCount: string;
    currentVolumes: number;
    volumeCount: number;
    rewatchCount: number;
    startDate: string;
    playTime: string;
    platform: string;
    externalId: string | null;
    currentMode: string;
  };
  isRefetching: boolean;
  handleRefetch: () => void;
  refetchError: string | null;
}

/**
 * Renders the left side of the entry editor (Metadata, Cast, Tags).
 */
export function LogEntryEditLeftPanel({ state, isRefetching, handleRefetch, refetchError }: LogEntryEditLeftPanelProps) {
  const {
    title, setTitle,
    mediaType, setMediaType,
    isMovie, setIsMovie,
    image, setImage,
    description, setDescription,
    releaseYear, setReleaseYear,
    director, setDirector,
    producer, setProducer,
    tags, setTags,
    imdbRating, setImdbRating,
    activeField, setActiveField,
    cast, setCast,
  } = state;

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {/* Basic Media Info */}
      <div className="flex gap-6">
        <div className="flex-shrink-0 w-32 group relative">
          {image ? (
            <div className="w-full h-48 rounded-lg overflow-hidden border border-zinc-800 shadow-xl bg-zinc-900">
              <img src={image} alt="Poster" className="w-full h-full object-cover" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <div className="w-full h-48 rounded-lg border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 text-zinc-600 hover:border-zinc-700 hover:text-zinc-500 transition-all cursor-pointer">
              <Search className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase">No Image</span>
            </div>
          )}
        </div>

        <div className="flex-grow space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-grow space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Type</label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as EntryMediaType)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="movie">Movie</option>
                <option value="series">Series</option>
                <option value="anime">Anime</option>
                <option value="manga">Manga</option>
                <option value="game">Game</option>
              </select>
            </div>
            <div className="w-24 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Year</label>
              <input
                type="text"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                placeholder="YYYY"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Refetch Trigger */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleRefetch}
          disabled={isRefetching}
          className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 text-zinc-200 text-xs font-bold uppercase tracking-widest rounded-md border border-zinc-700 transition-all"
        >
          <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
          {isRefetching ? "Refetching..." : "Update Metadata from API"}
        </button>
        {refetchError && <span className="text-[10px] text-red-500 font-medium px-1">{refetchError}</span>}
      </div>

      {/* Metadata Fields (extracted component) */}
      <div className="space-y-6 pt-6 border-t border-zinc-800">
        <LogEntryMetadata
          mediaType={mediaType}
          isMovie={isMovie}
          setIsMovie={setIsMovie}
          title={title}
          image={image}
          director={director}
          setDirector={setDirector}
          producer={producer}
          setProducer={setProducer}
          imdbRating={imdbRating}
          setImdbRating={setImdbRating}
          description={description}
          setDescription={setDescription}
          tags={tags}
          setTags={setTags}
          cast={cast}
          onCastChange={setCast}
          activeField={activeField}
          setActiveField={setActiveField}
          releaseYear={releaseYear}
          onReleaseYearChange={setReleaseYear}
          onTitleChange={setTitle}
          currentMode={state.currentMode as any}
          externalId={state.externalId}
          onRefetch={handleRefetch}
          isRefetching={isRefetching}
          refetchError={refetchError}
        />
      </div>
    </div>
  );
}

