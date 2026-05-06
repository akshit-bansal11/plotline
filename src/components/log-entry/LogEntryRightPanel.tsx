// File: src/components/log-entry/LogEntryRightPanel.tsx
// Purpose: Right panel of the log entry editor focusing on status, progress, dates, relations, and list assignments

"use client";

// ─── React

// ─── Internal — context
import type { EntryDoc } from "@/context/DataContext";

// ─── Internal — services
import type { RelationType } from "@/services/relations";

// ─── Internal — types
import type { EditableRelation, EntryMediaType, EntryStatusValue } from "@/types/log-entry";

// ─── Internal — components
import { LogEntryForm } from "./LogEntryForm";
import { LogEntryRelations } from "./LogEntryRelations";

// ─── Internal — utils

interface LogEntryRightPanelProps {
  uid: string | null;
  state: {
    mediaType: EntryMediaType;
    isMovie: boolean;
    status: EntryStatusValue;
    setStatus: (val: EntryStatusValue) => void;
    userRating: string;
    setUserRating: (val: string) => void;
    currentEpisodes: number;
    setCurrentEpisodes: (val: number) => void;
    episodeCount: string;
    currentSeasons: number;
    setCurrentSeasons: (val: number) => void;
    totalSeasons: number;
    setTotalSeasons: (val: number) => void;
    currentChapters: number;
    setCurrentChapters: (val: number) => void;
    chapterCount: string;
    currentVolumes: number;
    setCurrentVolumes: (val: number) => void;
    volumeCount: number;
    setVolumeCount: (val: number) => void;
    rewatchCount: number;
    setRewatchCount: (val: number) => void;
    playTime: string;
    setPlayTime: (val: string) => void;
    platform: string;
    setPlatform: (val: string) => void;
    startDate: string;
    setStartDate: (val: string) => void;
    completionDate: string;
    setCompletionDate: (val: string) => void;
    completionUnknown: boolean;
    setCompletionUnknown: (val: boolean) => void;
    selectedListIds: Set<string>;
    setSelectedListIds: (val: Set<string>) => void;
    availableLists: Array<{ id: string; name: string; types: EntryMediaType[] }>;
    relations: EditableRelation[];
    setRelations: (val: EditableRelation[]) => void;
    relationQuery: string;
    setRelationQuery: (val: string) => void;
    selectedRelationDoc: EntryDoc | null;
    setSelectedRelationDoc: (val: EntryDoc | null) => void;
    selectedRelationType: RelationType;
    setSelectedRelationType: (val: RelationType) => void;
    entries: EntryDoc[];
    imdbRating: string;
    externalId: string | null;
    setExternalId: (val: string | null) => void;
    currentMode: "create" | "view" | "edit";
  };
  setIsNewListOpen: (val: boolean) => void;
}

/**
 * Renders the right side of the entry editor (Status, Progress, Lists, Relations).
 */
export function LogEntryRightPanel({ state, setIsNewListOpen }: LogEntryRightPanelProps) {
  const {
    mediaType,
    isMovie,
    status,
    setStatus,
    userRating,
    setUserRating,
    currentEpisodes,
    setCurrentEpisodes,
    episodeCount,
    currentSeasons,
    setCurrentSeasons,
    totalSeasons,

    currentChapters,
    setCurrentChapters,
    chapterCount,
    currentVolumes,
    setCurrentVolumes,
    volumeCount,

    rewatchCount,
    setRewatchCount,
    playTime,
    setPlayTime,
    platform,
    setPlatform,
    startDate,
    setStartDate,
    completionDate,
    setCompletionDate,
    completionUnknown,
    setCompletionUnknown,
    selectedListIds,
    setSelectedListIds,
    availableLists,
    relations,
    setRelations,
    relationQuery,
    setRelationQuery,
    selectedRelationDoc,
    setSelectedRelationDoc,
    selectedRelationType,
    setSelectedRelationType,
    entries,
    imdbRating,
    externalId,
  } = state;

  return (
    <div className="flex flex-col gap-8 p-6 bg-zinc-900/30 overflow-y-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {/* Status & Progress Section */}
      <section className="space-y-4">
        <LogEntryForm
          status={status}
          onStatusChange={setStatus}
          statusOptions={[
            "watching",
            "reading",
            "playing",
            "rewatching",
            "rereading",
            "replaying",
            "plan_to_watch",
            "plan_to_read",
            "plan_to_play",
            "backlogged",
            "completed",
            "fully_completed",
            "on_hold",
            "dropped",
          ]}
          userRating={userRating}
          onUserRatingChange={setUserRating}
          mediaType={mediaType}
          isMovie={isMovie}
          currentEpisodes={currentEpisodes}
          onCurrentEpisodesChange={setCurrentEpisodes}
          episodeCount={episodeCount}
          currentSeasons={currentSeasons}
          onCurrentSeasonsChange={setCurrentSeasons}
          totalSeasons={totalSeasons}
          currentChapters={currentChapters}
          onCurrentChaptersChange={setCurrentChapters}
          chapterCount={chapterCount}
          currentVolumes={currentVolumes}
          onCurrentVolumesChange={setCurrentVolumes}
          volumeCount={volumeCount}
          rewatchLabel={
            mediaType === "game" ? "REPLAYS" : mediaType === "manga" ? "REREADS" : "REWATCHES"
          }
          rewatchCount={rewatchCount}
          onRewatchCountChange={setRewatchCount}
          availableLists={availableLists}
          selectedListIds={selectedListIds}
          onSelectedListIdsChange={setSelectedListIds}
          onOpenNewList={() => setIsNewListOpen(true)}
          startDate={startDate}
          onStartDateChange={setStartDate}
          completionDate={completionDate}
          onCompletionDateChange={setCompletionDate}
          completionUnknown={completionUnknown}
          onCompletionUnknownChange={setCompletionUnknown}
          statusIsComplete={status === "completed"}
          isViewMode={false}
          imdbRating={imdbRating}
          lengthMinutes={
            mediaType === "movie" || isMovie
              ? String(
                  entries.find((e) => String(e.id) === String(externalId))?.lengthMinutes || "",
                )
              : ""
          }
          playTime={playTime}
          onPlayTimeChange={setPlayTime}
          platform={platform}
          onPlatformChange={setPlatform}
        />
      </section>

      {/* Relations Section */}
      <section className="space-y-4 pt-4 border-t border-zinc-800/50">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
          Relationships
        </h3>
        <LogEntryRelations
          relations={relations}
          setRelations={setRelations}
          relationQuery={relationQuery}
          onRelationQueryChange={setRelationQuery}
          selectedRelationDoc={selectedRelationDoc}
          onSelectedRelationDocChange={setSelectedRelationDoc}
          selectedRelationType={selectedRelationType}
          onSelectedRelationTypeChange={setSelectedRelationType}
          entries={entries || []}
          normalizedInitialId={externalId}
          relatedTargetIdSet={new Set(relations.map((r) => r.targetId))}
          onAddRelation={(rel) => setRelations([...relations, rel])}
          onRemoveRelation={(idx) => setRelations(relations.filter((_, i) => i !== idx))}
          error={null}
          onError={() => {}}
          isViewMode={false}
        />
      </section>
    </div>
  );
}
