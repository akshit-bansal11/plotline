import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import type { ListMediaType } from "../types/log-entry";

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [active]);
}

export function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

export function useLists(uid: string | null, isOpen: boolean) {
  const [lists, setLists] = useState<
    { id: string; name: string; type: ListMediaType; types: ListMediaType[] }[]
  >([]);

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }
    const q = query(collection(db, "users", uid, "lists"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setLists(
        snap.docs.map((d) => {
          const data = d.data() as { name?: string; type?: string; types?: string[] };
          const singleType = (
            ["movie", "series", "anime", "manga", "game"].includes(data.type ?? "")
              ? data.type
              : "movie"
          ) as ListMediaType;
          const types = (
            Array.isArray(data.types)
              ? data.types.filter((t): t is ListMediaType =>
                  ["movie", "series", "anime", "manga", "game"].includes(t),
                )
              : [singleType]
          ) as ListMediaType[];
          return { id: d.id, name: data.name || "Untitled List", type: singleType, types };
        }),
      );
    });
  }, [uid, isOpen]);

  return lists;
}

export function useInitialListIds(
  uid: string | null,
  isOpen: boolean,
  isEditing: boolean,
  entryId: string | number | null | undefined,
  listIds: string[] | undefined,
  lists: { id: string }[],
  setSelectedListIds: (ids: Set<string>) => void,
  setInitialListIds: (ids: Set<string>) => void,
) {
  const fetchedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!uid || !isOpen || !isEditing || !entryId || lists.length === 0) return;
    if (fetchedRef.current === entryId) return;

    let cancelled = false;

    (async () => {
      if (listIds && listIds.length > 0) {
        if (cancelled) return;
        const ids = new Set(listIds);
        setSelectedListIds(ids);
        setInitialListIds(ids);
        fetchedRef.current = entryId;
        return;
      }

      const strId = String(entryId);
      const found = new Set<string>();
      const checks = lists.map(async (list) => {
        const snap = await getDocs(
          query(
            collection(db, "users", uid, "lists", list.id, "items"),
            where("externalId", "==", strId),
            limit(1),
          ),
        );
        return snap.empty ? null : list.id;
      });
      (await Promise.all(checks)).forEach((id) => {
        if (id) found.add(id);
      });
      if (cancelled) return;
      setSelectedListIds(found);
      setInitialListIds(found);
      fetchedRef.current = entryId;
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, isOpen, isEditing, entryId, listIds, lists, setSelectedListIds, setInitialListIds]);
}
