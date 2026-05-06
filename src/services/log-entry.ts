// File: src/services/log-entry.ts
// Purpose: Firestore services for managing log entries, lists, and relationships

// ─── Firebase
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
// ─── Internal — services
import { db } from "@/lib/firebase";
import { updateBidirectionalRelations } from "@/services/relations";
// ─── Internal — types
import type { LogEntryData } from "../types/log-entry";

// ─── Types
export type SaveEntryParams = {
  uid: string;
  isEditing: boolean;
  entryId: string | null;
  entryData: LogEntryData;
  trimmedTitle: string;
  listMediaType: string;
  image: string | null;
  releaseYearValue: string | null;
  selectedListIds: Set<string>;
  initialListIds: Set<string>;
  originalRelations: { targetId: string; type: string; createdAtMs: number }[];
  relationPayload: { targetId: string; type: string; createdAtMs: number }[];
};

// ─── Services: Save Entry
/**
 * Saves a log entry to Firestore, updating associated lists and bidirectional relationships.
 */
export async function saveLogEntry({
  uid,
  isEditing,
  entryId,
  entryData,
  trimmedTitle,
  listMediaType,
  image,
  releaseYearValue,
  selectedListIds,
  initialListIds,
  originalRelations,
  relationPayload,
}: SaveEntryParams) {
  let finalEntryId = entryId;

  if (isEditing && entryId) {
    await updateDoc(doc(db, "users", uid, "entries", entryId), { ...entryData });
  } else {
    const ref = await addDoc(collection(db, "users", uid, "entries"), {
      ...entryData,
      createdAt: serverTimestamp(),
    });
    finalEntryId = ref.id;
  }

  if (!finalEntryId) throw new Error("No entry ID");

  const addedIds = Array.from(selectedListIds).filter((id) => !initialListIds.has(id));
  const removedIds = Array.from(initialListIds).filter((id) => !selectedListIds.has(id));
  const commonIds = Array.from(selectedListIds).filter((id) => initialListIds.has(id));

  await Promise.all([
    ...addedIds.map((listId) =>
      addDoc(collection(db, "users", uid, "lists", listId, "items"), {
        title: trimmedTitle,
        mediaType: listMediaType,
        externalId: finalEntryId,
        image,
        year: releaseYearValue,
        addedAt: serverTimestamp(),
      }).then(() =>
        updateDoc(doc(db, "users", uid, "lists", listId), { updatedAt: serverTimestamp() }),
      ),
    ),
    ...removedIds.map(async (listId) => {
      const snap = await getDocs(
        query(
          collection(db, "users", uid, "lists", listId, "items"),
          where("externalId", "==", finalEntryId),
          limit(1),
        ),
      );
      if (!snap.empty) {
        await deleteDoc(doc(db, "users", uid, "lists", listId, "items", snap.docs[0].id));
        await updateDoc(doc(db, "users", uid, "lists", listId), {
          updatedAt: serverTimestamp(),
        });
      }
    }),
    ...commonIds.map(async (listId) => {
      const snap = await getDocs(
        query(
          collection(db, "users", uid, "lists", listId, "items"),
          where("externalId", "==", finalEntryId),
          limit(1),
        ),
      );
      if (!snap.empty)
        await updateDoc(doc(db, "users", uid, "lists", listId, "items", snap.docs[0].id), {
          title: trimmedTitle,
          mediaType: listMediaType,
          image,
          year: releaseYearValue,
        });
    }),
  ]);

  await updateBidirectionalRelations(
    uid,
    finalEntryId,
    originalRelations,
    relationPayload.map(({ targetId, type }) => ({ targetId, type })),
  );

  return finalEntryId;
}

// ─── Services: Delete Entry
/**
 * Deletes a log entry from Firestore, cleaning up all references in lists and relationships.
 */
export async function deleteLogEntry(
  uid: string,
  entryId: string,
  entries: { id: string; relations: { targetId: string; type: string; createdAtMs?: number }[] }[],
) {
  const entryRef = doc(db, "users", uid, "entries", entryId);

  const entryToDeleteRow = entries.find((e) => e.id === entryId);
  await updateBidirectionalRelations(uid, entryId, entryToDeleteRow?.relations || [], []);

  const danglingRelationSources = entries.filter(
    (candidate) =>
      candidate.id !== entryId &&
      candidate.relations.some((relation) => relation.targetId === entryId),
  );

  await Promise.all(
    danglingRelationSources.map((candidate) => {
      const cleanedRelations = candidate.relations.filter(
        (relation) => relation.targetId !== entryId,
      );
      return updateDoc(doc(db, "users", uid, "entries", candidate.id), {
        relations: cleanedRelations,
        updatedAt: serverTimestamp(),
      });
    }),
  );

  const listsSnap = await getDocs(collection(db, "users", uid, "lists"));
  const batch = writeBatch(db);

  for (const listDoc of listsSnap.docs) {
    const itemsSnap = await getDocs(
      query(
        collection(db, "users", uid, "lists", listDoc.id, "items"),
        where("externalId", "==", entryId),
      ),
    );
    for (const itemDoc of itemsSnap.docs) {
      batch.delete(itemDoc.ref);
    }
  }

  batch.delete(entryRef);
  await batch.commit();
}
