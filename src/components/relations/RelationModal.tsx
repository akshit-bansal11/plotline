// File: src/components/relations/RelationModal.tsx
// Purpose: Modal for creating and configuring relationships between log entries (sequels, prequels, etc.)

"use client";

// ─── React
import { useState } from "react";

// ─── Firebase
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

// ─── Internal — services
import { db } from "@/lib/firebase";
import {
  inverseRelationMap,
  RELATION_OPTIONS,
  type RelationType,
  updateBidirectionalRelations,
} from "@/services/relations";

// ─── Internal — components
import { Modal } from "@/components/overlay/Modal";

// ─── Internal — types
import type { EntryDoc } from "@/context/DataContext";

// ─── Types
export type RelationModalData = {
  sourceId: string;
  targetId: string;
  type: RelationType;
  targetTitle: string;
  sourceTitle: string;
};

interface RelationModalProps {
  isOpen: boolean;
  uid: string | null;
  entries: EntryDoc[];
  data: RelationModalData | null;
  onClose: () => void;
  onSuccess: (announcement: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a modal to define the relationship type between two entries.
 */
export function RelationModal({
  isOpen,
  uid,
  entries,
  data,
  onClose,
  onSuccess,
}: RelationModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localType, setLocalType] = useState<RelationType>(data?.type || "Sequel");

  if (!data) return null;

  const handleSave = async () => {
    if (!uid || !data || isSaving) return;
    
    const sourceDoc = entries.find(e => String(e.id) === data.sourceId);
    if (!sourceDoc) return;

    const oldRelations = Array.isArray(sourceDoc.relations)
      ? sourceDoc.relations.filter(r => r.targetId && r.type && !r.inferred)
      : [];
    
    const sourceRelationType = inverseRelationMap[localType] || localType;
    const existing = oldRelations.find(r => r.targetId === data.targetId);

    if (existing?.type === sourceRelationType) {
      setError("This relationship already exists.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedRelation = {
        targetId: data.targetId,
        type: sourceRelationType,
        createdAtMs: Date.now(),
      };

      const newRelations = [
        ...oldRelations.filter(r => r.targetId !== data.targetId),
        updatedRelation,
      ];

      await updateDoc(doc(db, "users", uid, "entries", data.sourceId), {
        relations: newRelations,
        updatedAt: serverTimestamp(),
      });

      await updateBidirectionalRelations(uid, data.sourceId, oldRelations, newRelations);

      const announcement = existing
        ? `Updated: ${data.targetTitle} is now ${localType} of ${data.sourceTitle}.`
        : `Linked: ${data.targetTitle} is ${localType} of ${data.sourceTitle}.`;

      onSuccess(announcement);
      onClose();
    } catch (err) {
      setError("Failed to save relationship.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSaving && onClose()}
      title="Link Entries"
      className="max-w-md bg-zinc-950 border border-zinc-800"
    >
      <div className="space-y-6">
        <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Establishing a link between <span className="text-zinc-100 font-bold">{data.sourceTitle}</span> and <span className="text-zinc-100 font-bold">{data.targetTitle}</span>.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Relationship Type</label>
          <select
            value={localType}
            onChange={(e) => {
              setError(null);
              setLocalType(e.target.value as RelationType);
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          >
            {RELATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 px-1 italic">
            {data.sourceTitle} will be marked as {localType} of {data.targetTitle}.
          </p>
        </div>

        {error && <div className="text-xs text-red-500 font-medium px-1">{error}</div>}

        <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {isSaving ? "Linking..." : "Confirm Link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
