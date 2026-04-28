import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import type { EntryDoc } from "@/context/DataContext";
import { db } from "@/lib/firebase";
import {
  inverseRelationMap,
  RELATION_OPTIONS,
  type RelationType,
  updateBidirectionalRelations,
} from "@/services/relations";

export type RelationModalData = {
  sourceId: string;
  targetId: string;
  type: RelationType;
  targetTitle: string;
  sourceTitle: string;
};

export function RelationModal({
  uid,
  entries,
  data,
  onClose,
  onSuccess,
}: {
  uid: string | null;
  entries: EntryDoc[];
  data: RelationModalData;
  onClose: () => void;
  onSuccess: (announcement: string) => void;
}) {
  const [relationModalError, setRelationModalError] = useState<string | null>(null);
  const [isRelationSaving, setIsRelationSaving] = useState(false);
  const [localType, setLocalType] = useState<RelationType>(data.type);

  const handleSave = async () => {
    if (!uid || !data || isRelationSaving) return;
    const sourceDoc = entries.find((e) => String(e.id) === data.sourceId);
    if (!sourceDoc) return;

    const oldRelations = Array.isArray(sourceDoc.relations)
      ? sourceDoc.relations.filter((r) => Boolean(r.targetId) && Boolean(r.type) && !r.inferred)
      : [];
    const sourceRelationType = inverseRelationMap[localType] || localType;

    const relationsForTarget = oldRelations.filter((r) => r.targetId === data.targetId);
    const existingRelation = relationsForTarget[0] || null;
    if (relationsForTarget.length === 1 && existingRelation?.type === sourceRelationType) {
      setRelationModalError("This relationship already exists.");
      return;
    }

    const updatedRelation = {
      targetId: data.targetId,
      type: sourceRelationType,
      createdAtMs: Date.now(),
    };

    const newRelations = [
      ...oldRelations.filter((r) => r.targetId !== data.targetId),
      updatedRelation,
    ];

    setRelationModalError(null);
    setIsRelationSaving(true);
    try {
      await updateDoc(doc(db, "users", uid, "entries", data.sourceId), {
        relations: newRelations,
        updatedAt: serverTimestamp(),
      });

      await updateBidirectionalRelations(uid, data.sourceId, oldRelations, newRelations);
      
      const announcement = existingRelation
        ? `Updated: ${data.targetTitle} is now ${localType} of ${data.sourceTitle}.`
        : `Linked: ${data.targetTitle} is ${localType} of ${data.sourceTitle}.`;
      
      onSuccess(announcement);
    } catch {
      setRelationModalError("Failed to save relationship. Please try again.");
    } finally {
      setIsRelationSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (isRelationSaving) return;
        onClose();
      }}
      title="Create Relationship"
      className="bg-neutral-900/80 max-w-md"
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-300">
          You dropped <strong>{data.sourceTitle}</strong> onto <strong>{data.targetTitle}</strong>.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400" htmlFor="relationship-type">
            Relationship Type
          </label>
          <select
            id="relationship-type"
            value={localType}
            onChange={(e) => {
              setRelationModalError(null);
              setLocalType(e.target.value as RelationType);
            }}
            className="w-full bg-neutral-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-white/20"
          >
            {RELATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-neutral-500 mt-1">
            This will set <span className="text-white">{data.sourceTitle}</span> as a{" "}
            <span className="text-white font-medium">{localType}</span> of{" "}
            <span className="text-white">{data.targetTitle}</span>.
          </p>
        </div>
        {relationModalError ? <div className="text-xs text-red-400">{relationModalError}</div> : null}
        <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
            disabled={isRelationSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
            disabled={isRelationSaving}
          >
            {isRelationSaving ? "Saving..." : "Create Link"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
