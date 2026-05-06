// File: src/components/log-entry/LogEntryRelations.tsx
// Purpose: Relationship management section for log entries

import { Search, X } from "lucide-react";
import Image from "next/image";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import type { EntryDoc } from "@/context/DataContext";
import { RELATION_OPTIONS, type RelationType } from "@/services/relations";
import type { EditableRelation } from "../../types/log-entry";
import { SectionHeader } from "./SectionHeader";

interface LogEntryRelationsProps {
  relations: readonly EditableRelation[];
  setRelations: (v: EditableRelation[]) => void;
  relationQuery: string;
  onRelationQueryChange: (v: string) => void;
  selectedRelationDoc: EntryDoc | null;
  onSelectedRelationDocChange: (v: EntryDoc | null) => void;
  selectedRelationType: RelationType;
  onSelectedRelationTypeChange: (v: RelationType) => void;
  entries: readonly EntryDoc[];
  normalizedInitialId: string | null;
  relatedTargetIdSet: Set<string>;
  onAddRelation: (rel: EditableRelation) => void;
  onRemoveRelation: (idx: number) => void;
  error: string | null;
  onError: (v: string | null) => void;
  isViewMode: boolean;
}

export function LogEntryRelations({
  relations,
  relationQuery,
  onRelationQueryChange,
  selectedRelationDoc,
  onSelectedRelationDocChange,
  selectedRelationType,
  onSelectedRelationTypeChange,
  entries,
  normalizedInitialId,
  relatedTargetIdSet,
  onAddRelation,
  onRemoveRelation,
  onError,
  isViewMode,
}: LogEntryRelationsProps) {
  if (isViewMode) {
    if (relations.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20 mb-3">
          RELATIONS
        </div>
        <div className="flex flex-wrap gap-3">
          {relations.map((rel) => (
            <div
              key={rel.targetId}
              className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 pr-4 rounded-lg min-w-[200px]"
            >
              <div className="w-10 h-14 relative rounded overflow-hidden bg-[#222] shrink-0">
                {rel.image && <Image src={rel.image} alt="" fill className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white font-medium truncate">{rel.title}</div>
                <div className="text-[10px] text-[#555] font-mono uppercase mt-0.5">{rel.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <SectionHeader title="Relations" />

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
        <input
          value={relationQuery}
          onChange={(e) => {
            onRelationQueryChange(e.target.value);
            onSelectedRelationDocChange(null);
          }}
          placeholder="Search for related media…"
          className="w-full bg-[#1a1a1a] border border-white/5 rounded-lg py-3 pl-11 pr-4 text-[13px] text-white placeholder-[#444] focus:outline-none focus:border-white/10"
        />
        {relationQuery && !selectedRelationDoc && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-20">
            {entries
              .filter(
                (ent) =>
                  ent.title.toLowerCase().includes(relationQuery.toLowerCase()) &&
                  String(ent.id) !== String(normalizedInitialId ?? "") &&
                  !relatedTargetIdSet.has(String(ent.id)),
              )
              .map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => {
                    onSelectedRelationDocChange(ent);
                    onRelationQueryChange(ent.title);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[12px] text-[#888] hover:bg-white/[0.03] hover:text-white transition-colors"
                >
                  {ent.title}
                </button>
              ))}
          </div>
        )}
      </div>

      {relations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {relations.map((rel, idx) => (
            <div
              key={rel.targetId}
              className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 pr-3 rounded-lg"
            >
              <div className="w-8 h-12 relative rounded overflow-hidden bg-[#222] shrink-0">
                {rel.image && <Image src={rel.image} alt="" fill className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white font-medium truncate max-w-[100px]">
                  {rel.title}
                </div>
                <div className="text-[10px] text-[#555] font-mono uppercase">{rel.type}</div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveRelation(idx)}
                className="text-[#444] hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedRelationDoc && (
        <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/10 space-y-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 relative rounded overflow-hidden bg-[#222] shrink-0">
              {selectedRelationDoc.image && (
                <Image src={selectedRelationDoc.image} alt="" fill className="object-cover" />
              )}
            </div>
            <div className="text-[13px] font-bold text-white">{selectedRelationDoc.title}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2">
              RELATION TYPE
            </div>
            <CustomDropdown
              value={selectedRelationType}
              onChange={(v) => onSelectedRelationTypeChange(v as RelationType)}
              options={RELATION_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const targetId = String(selectedRelationDoc.id);
              if (relations.some((r) => r.targetId === targetId)) {
                onError("Already related. Remove it first to change type.");
                return;
              }
              onAddRelation({
                targetId,
                type: selectedRelationType,
                title: selectedRelationDoc.title,
                image: selectedRelationDoc.image,
                mediaType: selectedRelationDoc.mediaType,
              });
              onRelationQueryChange("");
              onSelectedRelationDocChange(null);
            }}
            className="w-full py-2.5 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-neutral-200 transition-colors uppercase tracking-widest"
          >
            CONFIRM ATTACHMENT
          </button>
        </div>
      )}
    </div>
  );
}
