import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import type { EntryMediaType } from "@/context/DataContext";
import { db } from "@/lib/firebase";
import type { ListItemRow, ListRow } from "@/types/lists";
import { coerceListType, toMillis } from "@/utils/lists";

export function useLists(uid: string | null, mediaTypes: string[]) {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [listItemsById, setListItemsById] = useState<Record<string, ListItemRow[]>>({});
  const unsubscribersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!uid) {
      setLists([]);
      return;
    }

    const listsQuery = query(
      collection(db, "users", uid, "lists"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
      const nextLists = snapshot.docs.map((snap) => {
        const data = snap.data() as {
          name?: unknown;
          description?: unknown;
          type?: unknown;
          types?: unknown;
        };
        const singleType = coerceListType(data.type);
        const types = Array.isArray(data.types) ? (data.types as EntryMediaType[]) : [singleType];

        // Normalize types for filtering: if it has anime or anime_movie, it counts for both
        const normalizedTypes = types.map((t) => ((t as string) === "anime_movie" ? "anime" : t));

        return {
          id: snap.id,
          name: typeof data.name === "string" ? data.name : "",
          description: typeof data.description === "string" ? data.description : "",
          type: singleType,
          types,
          normalizedTypes,
        };
      });

      const filteredLists = nextLists.filter((list) =>
        list.normalizedTypes.some((t) => {
          const normalizedMediaTypes = mediaTypes.map((m) =>
            (m as string) === "anime_movie" ? "anime" : m,
          );
          return normalizedMediaTypes.includes(t);
        }),
      );

      setLists(filteredLists);
    });

    return () => unsubscribe();
  }, [mediaTypes, uid]);

  useEffect(() => {
    if (!uid) {
      setListItemsById({});
      return;
    }

    // Remove unsubscribers for lists that are no longer present
    const activeListIdSet = new Set(lists.map((l) => l.id));
    unsubscribersRef.current.forEach((unsub, id) => {
      if (!activeListIdSet.has(id)) {
        unsub();
        unsubscribersRef.current.delete(id);
        // Also clean up the items state
        setListItemsById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    // Create unsubscribers for new lists
    lists.forEach((list) => {
      if (!unsubscribersRef.current.has(list.id)) {
        const itemsQuery = query(
          collection(db, "users", uid, "lists", list.id, "items"),
          orderBy("addedAt", "desc"),
          limit(500),
        );
        const unsub = onSnapshot(itemsQuery, (snapshot) => {
          const nextItems = snapshot.docs.map((snap) => {
            const data = snap.data() as Partial<ListItemRow> & {
              mediaType?: unknown;
              externalId?: unknown;
              image?: unknown;
              year?: unknown;
              title?: unknown;
            };
            return {
              id: snap.id,
              title: typeof data.title === "string" ? data.title : "",
              mediaType: coerceListType(data.mediaType),
              externalId: typeof data.externalId === "string" ? data.externalId : "",
              image: data.image ? String(data.image) : null,
              year: data.year ? String(data.year) : null,
              sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : null,
              addedAtMs: toMillis((data as Record<string, unknown>).addedAt),
            };
          });
          const sortedItems = [...nextItems].sort((a, b) => {
            const aSort = a.sortOrder;
            const bSort = b.sortOrder;
            if (typeof aSort === "number" && typeof bSort === "number") return aSort - bSort;
            if (typeof aSort === "number") return -1;
            if (typeof bSort === "number") return 1;
            return (b.addedAtMs ?? 0) - (a.addedAtMs ?? 0);
          });
          setListItemsById((prev) => ({ ...prev, [list.id]: sortedItems }));
        });
        unsubscribersRef.current.set(list.id, unsub);
      }
    });
  }, [lists, uid]);

  useEffect(() => {
    const currentUnsubs = unsubscribersRef.current;
    return () => {
      for (const unsub of currentUnsubs.values()) {
        unsub();
      }
      currentUnsubs.clear();
    };
  }, []);

  return { lists, listItemsById };
}
