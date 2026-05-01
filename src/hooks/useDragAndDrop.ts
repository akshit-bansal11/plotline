// File: src/hooks/useDragAndDrop.ts
// Purpose: Drag and drop logic for list items, including reordering and relationship creation

// ─── React
import { useEffect, useState } from "react";

// ─── Firebase
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

// ─── Internal — services
import { db } from "@/lib/firebase";

// ─── Internal — types
import type { EntryDoc, EntryMediaType } from "@/types/log-entry";
import type { ListItemRow, ListRow } from "@/types/lists";

// ─── Internal — utils
import { entryMediaTypeLabels } from "@/utils";

/**
 * Manages drag and drop operations for entries between lists or to create relationships.
 */
export function useDragAndDrop({
  uid,
  entries,
  lists,
  listItemsById,
  onRelationDrop,
}: {
  uid: string | null;
  entries: EntryDoc[];
  lists: ListRow[];
  listItemsById: Record<string, ListItemRow[]>;
  onRelationDrop: (sourceId: string, targetId: string) => void;
}) {
  const [activeDrag, setActiveDrag] = useState<{
    entryId: string;
    sourceListId: string | null;
    isKeyboard: boolean;
  } | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<{
    listId: string | null;
    bucket: "list" | "other" | null;
  } | null>(null);
  const [reorderIndicator, setReorderIndicator] = useState<{
    listId: string;
    targetEntryId: string;
    position: "before" | "after";
  } | null>(null);
  const [isRemoveTargetActive, setIsRemoveTargetActive] = useState(false);
  const [dragAnnouncement, setDragAnnouncement] = useState("");

  // ─── Internal Actions
  const handleRelationDropInternal = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      handleItemDragEnd({ preserveAnnouncement: true });
      setDragAnnouncement("Cannot relate an entry to itself.");
      return;
    }
    const sourceEntry = entries.find((e) => String(e.id) === sourceId);
    const targetEntry = entries.find((e) => String(e.id) === targetId);
    if (!sourceEntry || !targetEntry) {
      handleItemDragEnd({ preserveAnnouncement: true });
      setDragAnnouncement("Could not create the relationship from this drop.");
      return;
    }

    onRelationDrop(sourceId, targetId);
    handleItemDragEnd({ preserveAnnouncement: true });
    setDragAnnouncement(
      `Dropped ${sourceEntry.title} onto ${targetEntry.title}. Choose a relationship type.`,
    );
  };

  // ─── Effect: Auto-scroll during drag
  useEffect(() => {
    if (!activeDrag) return;

    const threshold = 120;
    const speed = 15;
    let scrollInterval: ReturnType<typeof setInterval> | null = null;

    const handleDragOver = (e: DragEvent) => {
      const { clientY } = e;
      const innerHeight = window.innerHeight;

      if (clientY < threshold) {
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            window.scrollBy(0, -speed);
          }, 16);
        }
      } else if (clientY > innerHeight - threshold) {
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            window.scrollBy(0, speed);
          }, 16);
        }
      } else if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    const stopScroll = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragend", stopScroll);
    window.addEventListener("drop", stopScroll);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragend", stopScroll);
      window.removeEventListener("drop", stopScroll);
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [activeDrag]);

  // ─── Actions: Drag Start
  const handleItemDragStart = (details: {
    entryId: string | number;
    sourceListId: string | null;
    title: string;
    mode: "mouse" | "keyboard" | "touch";
  }) => {
    if (!uid) return;
    const entryId = String(details.entryId);
    setActiveDrag({
      entryId,
      sourceListId: details.sourceListId,
      isKeyboard: details.mode === "keyboard",
    });
    setDragAnnouncement(`Picked up ${details.title}. Navigate to a list and drop to move it.`);
    setReorderIndicator(null);
    setIsRemoveTargetActive(false);
  };

  // ─── Actions: Drag End
  const handleItemDragEnd = (options?: { preserveAnnouncement?: boolean }) => {
    if (activeDrag && !options?.preserveAnnouncement) {
      setDragAnnouncement("Drag cancelled.");
    }
    setActiveDrag(null);
    setActiveDropTarget(null);
    setReorderIndicator(null);
    setIsRemoveTargetActive(false);
  };

  // ─── Actions: Drop on List
  const handleDropOnList = async (targetListId: string | null) => {
    if (!uid || !activeDrag) return;
    const entry = entries.find((candidate) => candidate.id === activeDrag.entryId);
    if (!entry) {
      setDragAnnouncement("Could not find this item in the current view.");
      handleItemDragEnd({ preserveAnnouncement: true });
      return;
    }

    const sourceListId = activeDrag.sourceListId;
    const targetList = targetListId ? lists.find((list) => list.id === targetListId) || null : null;
    const targetItems = targetList ? listItemsById[targetList.id] || [] : [];

    if (targetListId && !targetList) {
      setDragAnnouncement("Target list is not available.");
      handleItemDragEnd({ preserveAnnouncement: true });
      return;
    }

    if (targetListId && sourceListId === targetListId) {
      setDragAnnouncement("This item is already in the selected list.");
      handleItemDragEnd({ preserveAnnouncement: true });
      return;
    }

    if (targetList) {
      const normalizedEntryType: EntryMediaType =
        (entry.mediaType as string) === "anime_movie" ? "anime" : entry.mediaType;
      if (!targetList.types.includes(normalizedEntryType)) {
        setDragAnnouncement(
          `This list only accepts ${targetList.types.map((t) => entryMediaTypeLabels[t]).join(", ")} items.`,
        );
        handleItemDragEnd({ preserveAnnouncement: true });
        return;
      }
      const alreadyInTarget = targetItems.some((item) => item.externalId === entry.id);
      if (alreadyInTarget) {
        setDragAnnouncement("This item is already in the target list.");
        handleItemDragEnd({ preserveAnnouncement: true });
        return;
      }
    }

    try {
      if (targetList) {
        const manualOrderValues = targetItems
          .map((item) => item.sortOrder)
          .filter((value): value is number => typeof value === "number");
        const nextSortOrder =
          manualOrderValues.length > 0 ? Math.max(...manualOrderValues) + 1 : null;
        await addDoc(collection(db, "users", uid, "lists", targetList.id, "items"), {
          title: entry.title,
          mediaType: entry.mediaType,
          externalId: entry.id,
          image: entry.image || null,
          year: entry.releaseYear || null,
          sortOrder: nextSortOrder,
          addedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", uid, "lists", targetList.id), {
          updatedAt: serverTimestamp(),
        });
      }

      if (sourceListId) {
        const sourceItems = listItemsById[sourceListId] || [];
        const sourceItem = sourceItems.find((item) => item.externalId === entry.id);
        if (sourceItem) {
          await deleteDoc(doc(db, "users", uid, "lists", sourceListId, "items", sourceItem.id));
          await updateDoc(doc(db, "users", uid, "lists", sourceListId), {
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (!targetList && sourceListId) {
        setDragAnnouncement(`Removed ${entry.title} from the list. It remains in Unspecified.`);
      } else {
        const targetName = targetList ? targetList.name || "List" : "Other";
        setDragAnnouncement(`Moved ${entry.title} to ${targetName}.`);
      }
    } catch (err) {
      console.error("Error moving item:", err);
      setDragAnnouncement("Failed to move item. Please try again.");
    } finally {
      handleItemDragEnd({ preserveAnnouncement: true });
    }
  };

  return {
    activeDrag,
    activeDropTarget,
    reorderIndicator,
    isRemoveTargetActive,
    dragAnnouncement,
    setActiveDropTarget,
    setReorderIndicator,
    setIsRemoveTargetActive,
    setDragAnnouncement,
    handleItemDragStart,
    handleItemDragEnd,
    handleDropOnList,
    handleRelationDrop: handleRelationDropInternal,
  };
}
