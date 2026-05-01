// File: src/components/log-entry/LogEntryViewPanel.tsx
// Purpose: Presentational component for the read-only view of a log entry

"use client";

// ─── React
import React from "react";

// ─── Icons
import { Calendar, Clock, Film, Gamepad2, Layers, BookOpen, User, Star } from "lucide-react";

// ─── Internal — types
import type { EntryDoc } from "@/context/DataContext";

// ─── Internal — utils
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";
import { formatISODate } from "@/utils/log-entry";

import { LogEntryForm, getStatusBadgeClass } from "./LogEntryForm";

interface LogEntryViewPanelProps {
  entry: EntryDoc;
  onEdit: () => void;
}

/**
 * Renders the read-only details of a log entry.
 */
export function LogEntryViewPanel({ entry, onEdit }: LogEntryViewPanelProps) {
  const isMovie = entry.mediaType === "movie" || (entry.mediaType === "anime" && entry.isMovie);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {/* Header Info */}
      <div className="flex gap-6">
        {entry.image && (
          <div className="flex-shrink-0 w-32 h-48 rounded-lg overflow-hidden border border-zinc-800 shadow-xl">
            <img 
              src={entry.image} 
              alt={entry.title} 
              className="w-full h-full object-cover" 
            />
          </div>
        )}
        <div className="flex-grow">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-100 leading-tight">{entry.title}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0",
                    getStatusBadgeClass(entry.status as any),
                  )}
                >
                  {entryStatusLabels[entry.status as any] ?? entry.status}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {entry.mediaType === "movie" || entry.mediaType === "series" || entry.mediaType === "anime" ? <Film className="w-3 h-3" /> : entry.mediaType === "game" ? <Gamepad2 className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                  {entryMediaTypeLabels[entry.mediaType]}
                  {entry.isMovie && " (Movie)"}
                  {entry.releaseYear && <span className="ml-1 text-zinc-600">• {entry.releaseYear}</span>}
                </span>
              </div>
            </div>
            <button
              onClick={onEdit}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors border border-zinc-700"
            >
              Edit Details
            </button>
          </div>

          {/* Description */}
          {entry.description && (
            <p className="mt-4 text-zinc-300 text-sm leading-relaxed">
              {entry.description}
            </p>
          )}

          {/* Stats Bar */}
          <div className="flex flex-wrap gap-4 mt-6">
            {entry.userRating && (
              <StatItem 
                icon={<Star className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />} 
                label="Rating" 
                value={`${entry.userRating}/10`} 
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-800">
        {/* Left: Metadata */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Metadata</h3>
          <dl className="space-y-3">
            {entry.director && <InfoRow label={entry.mediaType === "manga" ? "Writer" : entry.mediaType === "game" ? "Developer" : "Director"} value={entry.director} />}
            {entry.producer && <InfoRow label={entry.mediaType === "anime" || entry.mediaType === "series" ? "Studio" : entry.mediaType === "game" ? "Publisher" : "Producer"} value={entry.producer} />}
            {entry.lengthMinutes && <InfoRow label="Duration" value={`${entry.lengthMinutes}m`} />}
            {entry.episodeCount && !isMovie && <InfoRow label="Total Episodes" value={entry.episodeCount} />}
            {entry.chapterCount && <InfoRow label="Total Chapters" value={entry.chapterCount} />}
            {entry.imdbRating && <InfoRow label="IMDb Rating" value={entry.imdbRating} />}
          </dl>
        </div>

        {/* Right: Progress & Dates */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Your Progress</h3>
          <dl className="space-y-3">
            {entry.currentEpisodes > 0 && <InfoRow label="Episodes" value={`${entry.currentEpisodes} / ${entry.episodeCount || "?"}`} />}
            {entry.currentChapters > 0 && <InfoRow label="Chapters" value={`${entry.currentChapters} / ${entry.chapterCount || "?"}`} />}
            {entry.playTime && <InfoRow label="Play Time" value={entry.playTime} />}
            {entry.platform && <InfoRow label="Platform" value={entry.platform} />}
            {entry.startDate && <InfoRow label="Started" value={formatISODate(entry.startDate)} />}
            {entry.completedAt && <InfoRow label="Completed" value={formatISODate(entry.completedAt)} />}
            {entry.rewatchCount > 0 && (
              <InfoRow 
                label={
                  entry.mediaType === "manga" ? "Rereads" :
                  entry.mediaType === "game" ? "Replays" :
                  "Rewatches"
                } 
                value={entry.rewatchCount} 
              />
            )}
          </dl>
        </div>
      </div>

      {/* Tags & Cast */}
      {((entry.genresThemes && entry.genresThemes.length > 0) || (entry.tags && entry.tags.length > 0) || (entry.cast && entry.cast.length > 0)) && (
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-800">
          {(entry.genresThemes || entry.tags) && (entry.genresThemes?.length || entry.tags?.length) > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Genres & Themes</h3>
              <div className="flex flex-wrap gap-2">
                {(entry.genresThemes || entry.tags || []).map((tag: string) => (
                  <span 
                    key={tag} 
                    className="px-2.5 py-1 bg-zinc-900 text-zinc-400 text-[11px] font-medium rounded-full border border-zinc-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {entry.cast && entry.cast.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cast & Characters</h3>
              <div className="flex flex-wrap gap-2">
                {(entry.cast || []).map((person: string) => (
                  <span 
                    key={person} 
                    className="px-2.5 py-1 bg-zinc-900 text-zinc-400 text-[11px] font-medium rounded-full border border-zinc-800"
                  >
                    {person}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components
function StatItem({ icon, label, value, className }: { icon?: React.ReactNode; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight mb-0.5">{label}</span>
      <div className={cn("flex items-center gap-1.5 text-zinc-200 font-semibold", className)}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-200 font-medium">{value}</dd>
    </div>
  );
}
