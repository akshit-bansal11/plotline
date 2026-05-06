// File: src/components/log-entry/LogEntryForm.tsx
// Purpose: Main form fields and progress tracking for log entries

import { StarRating } from "@/components/ui/StarRating";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";
import type { EntryMediaType, EntryStatusValue } from "../../types/log-entry";
import { todayISODate } from "../../utils/log-entry";
import { SectionHeader } from "./SectionHeader";
import { StatColumn } from "./StatColumn";
import { Stepper } from "./Stepper";

interface LogEntryFormProps {
  readonly status: EntryStatusValue;
  readonly onStatusChange: (v: EntryStatusValue) => void;
  readonly statusOptions: readonly EntryStatusValue[];
  readonly userRating: string;
  readonly onUserRatingChange: (v: string) => void;
  readonly mediaType: EntryMediaType;
  readonly isMovie: boolean;
  readonly currentEpisodes: number;
  readonly onCurrentEpisodesChange: (v: number) => void;
  readonly episodeCount: string;
  readonly currentSeasons: number;
  readonly onCurrentSeasonsChange: (v: number) => void;
  readonly totalSeasons: number;
  readonly currentChapters: number;
  readonly onCurrentChaptersChange: (v: number) => void;
  readonly chapterCount: string;
  readonly currentVolumes: number;
  readonly onCurrentVolumesChange: (v: number) => void;
  readonly volumeCount: number;
  readonly rewatchLabel: string;
  readonly rewatchCount: number;
  readonly onRewatchCountChange: (v: number) => void;
  readonly availableLists: readonly { id: string; name: string; types: EntryMediaType[] }[];
  readonly selectedListIds: Set<string>;
  readonly onSelectedListIdsChange: (v: Set<string>) => void;
  readonly onOpenNewList: () => void;
  readonly startDate: string;
  readonly onStartDateChange: (v: string) => void;
  readonly completionDate: string;
  readonly onCompletionDateChange: (v: string) => void;
  readonly completionUnknown: boolean;
  readonly onCompletionUnknownChange: (v: boolean) => void;
  readonly statusIsComplete: boolean;
  readonly isViewMode: boolean;
  readonly imdbRating: string;
  readonly lengthMinutes: string;
  readonly playTime: string;
  readonly onPlayTimeChange: (v: string) => void;
  readonly platform: string;
  readonly onPlatformChange: (v: string) => void;
}

export const statusCategories = {
  active: ["watching", "reading", "playing", "rewatching", "rereading", "replaying"],
  planning: ["plan_to_watch", "plan_to_read", "plan_to_play", "backlogged"],
  completed: ["completed", "fully_completed"],
  paused: ["on_hold", "dropped"],
};

export const getStatusBadgeClass = (s: EntryStatusValue) => {
  switch (s) {
    case "completed":
    case "fully_completed":
      return "border-emerald-500/50 bg-emerald-950/80 text-emerald-400";
    case "watching":
    case "reading":
    case "playing":
      return "border-blue-500/50 bg-blue-950/80 text-blue-400";
    case "rewatching":
    case "rereading":
    case "replaying":
      return "border-sky-500/50 bg-sky-950/80 text-sky-400";
    case "plan_to_watch":
    case "plan_to_read":
    case "plan_to_play":
      return "border-violet-500/50 bg-violet-950/80 text-violet-400";
    case "on_hold":
    case "backlogged":
      return "border-yellow-500/50 bg-yellow-950/80 text-yellow-400";
    case "dropped":
      return "border-red-500/50 bg-red-950/80 text-red-400";
    default:
      return "border-neutral-500/30 bg-neutral-950/80 text-neutral-400";
  }
};

export function LogEntryForm({
  status,
  onStatusChange,
  statusOptions,
  userRating,
  onUserRatingChange,
  mediaType,
  isMovie,
  currentEpisodes,
  onCurrentEpisodesChange,
  episodeCount,
  currentSeasons,
  onCurrentSeasonsChange,
  totalSeasons,
  currentChapters,
  onCurrentChaptersChange,
  chapterCount,
  currentVolumes,
  onCurrentVolumesChange,
  volumeCount,
  rewatchLabel,
  rewatchCount,
  onRewatchCountChange,
  availableLists,
  selectedListIds,
  onSelectedListIdsChange,
  onOpenNewList,
  startDate,
  onStartDateChange,
  completionDate,
  onCompletionDateChange,
  completionUnknown,
  onCompletionUnknownChange,
  isViewMode,
  imdbRating,
  lengthMinutes,
  playTime,
  onPlayTimeChange,
  platform,
  onPlatformChange,
}: LogEntryFormProps) {
  const isAnimeMovie = mediaType === "anime" && isMovie;

  if (isViewMode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0",
                getStatusBadgeClass(status),
              )}
            >
              {entryStatusLabels[status] ?? status}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {entryMediaTypeLabels[mediaType]}
              {isMovie && " (Movie)"}
            </span>
          </div>
          {userRating && (
            <div className="p-3 bg-zinc-900/50 rounded-xl inline-flex flex-col w-max border border-white/5">
              <div className="px-1">
                <StarRating value={userRating} onChange={() => {}} readOnly showValue={false} />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-6 p-6 bg-zinc-900/50 rounded-xl border border-white/5">
          {(mediaType === "movie" || isMovie) && (
            <StatColumn label="DURATION" value={lengthMinutes ? `${lengthMinutes} min` : "—"} />
          )}

          {(mediaType === "series" || (mediaType === "anime" && !isMovie)) && (
            <>
              <StatColumn label="EPISODES" value={`${currentEpisodes} / ${episodeCount || "?"}`} />
              <StatColumn label="SEASONS" value={`${currentSeasons} / ${totalSeasons || "?"}`} />
            </>
          )}

          {mediaType === "manga" && (
            <>
              <StatColumn label="CHAPTERS" value={`${currentChapters} / ${chapterCount || "?"}`} />
              <StatColumn label="VOLUMES" value={`${currentVolumes} / ${volumeCount || "?"}`} />
            </>
          )}

          {rewatchCount > 0 && (
            <StatColumn
              label={
                mediaType === "game" ? "REPLAYS" : mediaType === "manga" ? "REREADS" : "REWATCHES"
              }
              value={String(rewatchCount)}
            />
          )}

          <StatColumn label="IMDB RATING" value={imdbRating ? `${imdbRating}` : "—"} />
          {playTime && <StatColumn label="PLAY TIME" value={playTime} />}
          {platform && <StatColumn label="PLATFORM" value={platform} />}
          {startDate && <StatColumn label="STARTED" value={startDate} />}
          {completionDate && !completionUnknown && (
            <StatColumn label="COMPLETED" value={completionDate} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Status & Ratings */}
      <div className="space-y-6">
        <div className="space-y-4">
          <SectionHeader title="Status" />
          <div className="flex flex-col gap-4">
            {Object.entries(statusCategories).map(([category, opts]) => {
              const filteredOpts = opts.filter((o) =>
                statusOptions.includes(o as EntryStatusValue),
              );
              if (filteredOpts.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 px-1">
                    {category}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {filteredOpts.map((opt) => {
                      const isSelected = status === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => onStatusChange(opt as EntryStatusValue)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border",
                            isSelected
                              ? getStatusBadgeClass(opt as EntryStatusValue)
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400",
                          )}
                        >
                          {entryStatusLabels[opt as EntryStatusValue] || opt.replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader title="Your Rating" />
          <StarRating value={userRating} onChange={onUserRatingChange} />
        </div>
      </div>

      {/* Progress Steppers */}
      <div className="space-y-6 pt-2">
        <SectionHeader title="Progress" />
        <div className="grid grid-cols-2 gap-8">
          {(mediaType === "series" || mediaType === "anime") && !isAnimeMovie && (
            <>
              <Stepper
                label="Episodes"
                value={currentEpisodes}
                onValueChange={onCurrentEpisodesChange}
                max={episodeCount ? parseInt(episodeCount, 10) : undefined}
              />
              <Stepper
                label="Seasons"
                value={currentSeasons}
                onValueChange={onCurrentSeasonsChange}
                max={totalSeasons || undefined}
              />
            </>
          )}
          {mediaType === "manga" && (
            <>
              <Stepper
                label="Chapters"
                value={currentChapters}
                onValueChange={onCurrentChaptersChange}
                max={chapterCount ? parseInt(chapterCount, 10) : undefined}
              />
              <Stepper
                label="Volumes"
                value={currentVolumes}
                onValueChange={onCurrentVolumesChange}
                max={volumeCount || undefined}
              />
            </>
          )}
          {mediaType === "game" && (
            <div className="grid grid-cols-2 gap-4 col-span-full">
              <div className="space-y-1.5">
                <label
                  htmlFor="form-playtime"
                  className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1"
                >
                  Play Time
                </label>
                <input
                  id="form-playtime"
                  type="text"
                  value={playTime}
                  onChange={(e) => onPlayTimeChange(e.target.value)}
                  placeholder="e.g. 20h 30m"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="form-platform"
                  className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1"
                >
                  Platform
                </label>
                <input
                  id="form-platform"
                  type="text"
                  value={platform}
                  onChange={(e) => onPlatformChange(e.target.value)}
                  placeholder="e.g. PC, PS5"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          )}
          <Stepper label={rewatchLabel} value={rewatchCount} onValueChange={onRewatchCountChange} />
        </div>
      </div>

      {/* Lists */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <SectionHeader title="Lists" />
          <button
            type="button"
            onClick={onOpenNewList}
            className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300 transition-colors"
          >
            + New List
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableLists.map((list) => {
            const isSelected = selectedListIds.has(list.id);
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => {
                  const next = new Set(selectedListIds);
                  if (next.has(list.id)) {
                    next.delete(list.id);
                  } else {
                    next.add(list.id);
                  }
                  onSelectedListIdsChange(next);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border",
                  isSelected
                    ? "bg-blue-600/10 border-blue-500/50 text-blue-400"
                    : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400",
                )}
              >
                {list.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dates */}
      <div className="space-y-6 pt-2">
        <SectionHeader title="Dates" />
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <label
              htmlFor="form-start-date"
              className="text-[10px] font-mono uppercase tracking-widest text-[#555]"
            >
              Start Date
            </label>
            <div className="flex items-center gap-2">
              <input
                id="form-start-date"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
              <button
                type="button"
                onClick={() => onStartDateChange(todayISODate())}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="form-completion-date"
                className="text-[10px] font-mono uppercase tracking-widest text-[#555]"
              >
                Completion Date
              </label>
              <button
                type="button"
                onClick={() => onCompletionUnknownChange(!completionUnknown)}
                className={cn(
                  "text-[9px] font-bold uppercase transition-colors",
                  completionUnknown ? "text-blue-400" : "text-zinc-600 hover:text-zinc-500",
                )}
              >
                Unknown
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="form-completion-date"
                type="date"
                value={completionDate}
                disabled={completionUnknown}
                onChange={(e) => onCompletionDateChange(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full disabled:opacity-30"
              />
              <button
                type="button"
                disabled={completionUnknown}
                onClick={() => onCompletionDateChange(todayISODate())}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
