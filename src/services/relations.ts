// File: src/services/relations.ts
// Purpose: Bidirectional relationship management services with transitive reconciliation

// ─── Firebase
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";

// ─── Internal — services
import { db } from "@/lib/firebase";

// ─── Types
export type RelationType =
  | "Prequel"
  | "Direct Prequel"
  | "Sequel"
  | "Direct Sequel"
  | "Parody"
  | "Original"
  | "Side-Story"
  | "Main Story"
  | "Compilation"
  | "Full Series"
  | "Summary"
  | "Full Story"
  | "Spin-off"
  | "Parent Story";

export type RelationRecord = {
  targetId: string;
  type: string;
  createdAtMs: number;
  inferred?: boolean;
};

type RelationInput = {
  targetId?: unknown;
  type?: unknown;
  createdAtMs?: unknown;
  createdAt?: unknown;
  inferred?: unknown;
};

// ─── Constants: Relation Mappings
export const inverseRelationMap: Record<RelationType, RelationType> = {
  Prequel: "Sequel",
  "Direct Prequel": "Direct Sequel",
  Sequel: "Prequel",
  "Direct Sequel": "Direct Prequel",
  Parody: "Original",
  Original: "Parody",
  "Side-Story": "Main Story",
  "Main Story": "Side-Story",
  Compilation: "Full Series",
  "Full Series": "Compilation",
  Summary: "Full Story",
  "Full Story": "Summary",
  "Spin-off": "Parent Story",
  "Parent Story": "Spin-off",
};

export const RELATION_OPTIONS: RelationType[] = [
  "Prequel",
  "Direct Prequel",
  "Sequel",
  "Direct Sequel",
  "Spin-off",
  "Side-Story",
  "Summary",
  "Compilation",
  "Parody",
];

const relationFamilyMap: Record<RelationType, RelationType> = {
  Prequel: "Prequel",
  "Direct Prequel": "Prequel",
  Sequel: "Sequel",
  "Direct Sequel": "Sequel",
  Parody: "Parody",
  Original: "Original",
  "Side-Story": "Side-Story",
  "Main Story": "Side-Story",
  Compilation: "Compilation",
  "Full Series": "Compilation",
  Summary: "Summary",
  "Full Story": "Summary",
  "Spin-off": "Spin-off",
  "Parent Story": "Spin-off",
};

const transitiveFamilies: RelationType[] = [
  "Sequel",
  "Prequel",
  "Spin-off",
  "Side-Story",
  "Parody",
  "Compilation",
  "Summary",
];

const relationTypeSet = new Set<RelationType>(Object.keys(inverseRelationMap) as RelationType[]);

// ─── Utils: Transformation
const toMillis = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value === "object" &&
    value &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

const asRelationType = (value: string): RelationType | null =>
  relationTypeSet.has(value as RelationType) ? (value as RelationType) : null;

const toRelationKey = (relation: { targetId: string; type: string }) =>
  `${relation.targetId}::${relation.type}`;

const toRelationStateKey = (relation: RelationRecord) =>
  `${relation.targetId}::${relation.type}::${relation.inferred ? "1" : "0"}`;

const normalizeRelations = (relations: RelationInput[]): RelationRecord[] => {
  const deduped = new Map<string, RelationRecord>();

  for (const relation of relations) {
    const targetId = String(relation.targetId || "").trim();
    const type = String(relation.type || "").trim();
    if (!targetId || !type) continue;

    const createdAtMs =
      toMillis(relation.createdAtMs) ?? toMillis(relation.createdAt) ?? Date.now();
    const inferred = relation.inferred === true;
    const key = `${targetId}::${type}`;
    const existing = deduped.get(key);
    if (!existing || (existing.inferred && !inferred)) {
      deduped.set(key, { targetId, type, createdAtMs, inferred });
    }
  }

  return Array.from(deduped.values());
};

// ─── Utils: Graph traversal
const buildReachability = (
  adjacency: Map<string, Set<string>>,
  sourceId: string,
): Map<string, number> => {
  const depths = new Map<string, number>();
  const queue: Array<{ node: string; depth: number }> = [];

  const sourceNeighbors = adjacency.get(sourceId);
  if (!sourceNeighbors) return depths;

  for (const neighbor of sourceNeighbors) {
    if (neighbor === sourceId) continue;
    depths.set(neighbor, 1);
    queue.push({ node: neighbor, depth: 1 });
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const { node, depth } = queue[cursor];
    cursor += 1;
    const neighbors = adjacency.get(node);
    if (!neighbors) continue;

    for (const next of neighbors) {
      if (next === sourceId) continue;
      const nextDepth = depth + 1;
      const previousDepth = depths.get(next);
      if (previousDepth !== undefined && previousDepth <= nextDepth) continue;
      depths.set(next, nextDepth);
      queue.push({ node: next, depth: nextDepth });
    }
  }

  return depths;
};

const relationSetSignature = (relations: RelationRecord[]) =>
  relations
    .map((relation) => toRelationStateKey(relation))
    .sort()
    .join("|");

// ─── Core Logic: Transitive Reconciliation
/**
 * Reconciles transitive relations across the entire entry collection.
 *
 * Transitive reconciliation ensures that if A is a prequel to B, and B is a prequel to C,
 * then A is automatically marked as an 'inferred' prequel to C.
 * This function reads ALL entries for the user to build the complete relationship graph.
 */
const reconcileTransitiveRelations = async (uid: string) => {
  const entriesSnapshot = await getDocs(collection(db, "users", uid, "entries"));
  const entryIds = entriesSnapshot.docs.map((entryDoc) => entryDoc.id);
  const entryIdSet = new Set(entryIds);

  const currentRelationsBySource = new Map<string, RelationRecord[]>();
  for (const entryDoc of entriesSnapshot.docs) {
    const data = entryDoc.data() as { relations?: RelationInput[] };
    const normalized = normalizeRelations(
      Array.isArray(data.relations) ? data.relations : [],
    ).filter((relation) => relation.targetId !== entryDoc.id && entryIdSet.has(relation.targetId));
    currentRelationsBySource.set(entryDoc.id, normalized);
  }
  for (const entryId of entryIds) {
    if (!currentRelationsBySource.has(entryId)) {
      currentRelationsBySource.set(entryId, []);
    }
  }

  const explicitRelationsBySource = new Map<string, RelationRecord[]>();
  for (const [sourceId, relations] of currentRelationsBySource.entries()) {
    explicitRelationsBySource.set(
      sourceId,
      relations.filter((relation) => !relation.inferred),
    );
  }

  const adjacencyByFamily = new Map<RelationType, Map<string, Set<string>>>();
  for (const family of transitiveFamilies) {
    adjacencyByFamily.set(family, new Map());
  }

  for (const [sourceId, relations] of explicitRelationsBySource.entries()) {
    for (const relation of relations) {
      const relationType = asRelationType(relation.type);
      if (!relationType) continue;
      const family = relationFamilyMap[relationType];
      const familyAdjacency = adjacencyByFamily.get(family);
      if (!familyAdjacency) continue;
      if (!familyAdjacency.has(sourceId)) {
        familyAdjacency.set(sourceId, new Set());
      }
      familyAdjacency.get(sourceId)?.add(relation.targetId);
    }
  }

  const finalRelationsBySource = new Map<string, RelationRecord[]>();
  for (const sourceId of entryIds) {
    const explicit = explicitRelationsBySource.get(sourceId) || [];
    const current = currentRelationsBySource.get(sourceId) || [];
    const occupiedTargets = new Set(explicit.map((relation) => relation.targetId));
    const derivedByTarget = new Map<string, RelationRecord>();

    for (const family of transitiveFamilies) {
      const familyAdjacency = adjacencyByFamily.get(family);
      if (!familyAdjacency) continue;
      const reachability = buildReachability(familyAdjacency, sourceId);
      for (const [targetId, depth] of reachability.entries()) {
        if (depth < 2) continue;
        if (targetId === sourceId) continue;
        if (occupiedTargets.has(targetId)) continue;
        if (derivedByTarget.has(targetId)) continue;

        const previous = current.find(
          (relation) =>
            relation.targetId === targetId && relation.type === family && relation.inferred,
        );
        derivedByTarget.set(targetId, {
          targetId,
          type: family,
          createdAtMs: previous?.createdAtMs ?? Date.now(),
          inferred: true,
        });
      }
    }

    finalRelationsBySource.set(
      sourceId,
      normalizeRelations([...explicit, ...Array.from(derivedByTarget.values())]),
    );
  }

  const allSourceIds = new Set<string>([...entryIds, ...Array.from(finalRelationsBySource.keys())]);

  for (const sourceId of allSourceIds) {
    const sourceRelations = finalRelationsBySource.get(sourceId) || [];
    for (const relation of sourceRelations) {
      const relationType = asRelationType(relation.type);
      if (!relationType) continue;
      const inverseType = inverseRelationMap[relationType];
      const targetId = relation.targetId;
      if (!entryIdSet.has(targetId)) continue;
      const targetRelations = finalRelationsBySource.get(targetId) || [];
      if (targetRelations.some((targetRelation) => targetRelation.targetId === sourceId)) continue;

      const currentTargetRelations = currentRelationsBySource.get(targetId) || [];
      const previous = currentTargetRelations.find(
        (targetRelation) =>
          targetRelation.targetId === sourceId &&
          targetRelation.type === inverseType &&
          targetRelation.inferred === relation.inferred,
      );

      finalRelationsBySource.set(
        targetId,
        normalizeRelations([
          ...targetRelations,
          {
            targetId: sourceId,
            type: inverseType,
            createdAtMs: previous?.createdAtMs ?? Date.now(),
            inferred: relation.inferred,
          },
        ]),
      );
    }
  }

  const updates: Promise<void>[] = [];
  for (const entryId of entryIds) {
    const currentRelations = currentRelationsBySource.get(entryId) || [];
    const finalRelations = finalRelationsBySource.get(entryId) || [];

    if (relationSetSignature(currentRelations) === relationSetSignature(finalRelations)) {
      continue;
    }

    const payload = finalRelations
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((relation) => ({
        targetId: relation.targetId,
        type: relation.type,
        createdAtMs: relation.createdAtMs,
        ...(relation.inferred ? { inferred: true } : {}),
      }));

    updates.push(
      updateDoc(doc(db, "users", uid, "entries", entryId), {
        relations: payload,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  await Promise.all(updates);
};

// ─── Core Logic: Bidirectional Sync
/**
 * Updates bidirectional relationships between a source entry and its targets.
 *
 * 'Bidirectional' means that if A is marked as a prequel to B, B is automatically
 * marked as a sequel to A. This function manages adding and removing these
 * inverse entries on the target documents.
 */
export const updateBidirectionalRelations = async (
  uid: string,
  sourceId: string,
  oldRelations: { targetId: string; type: string; createdAtMs?: number }[],
  newRelations: { targetId: string; type: string; createdAtMs?: number }[],
) => {
  const normalizedOldRelations = normalizeRelations(oldRelations).filter(
    (relation) => !relation.inferred,
  );
  const normalizedNewRelations = normalizeRelations(newRelations).filter(
    (relation) => !relation.inferred,
  );

  const oldMap = new Map(
    normalizedOldRelations.map((relation) => [toRelationKey(relation), relation]),
  );
  const newMap = new Map(
    normalizedNewRelations.map((relation) => [toRelationKey(relation), relation]),
  );

  const added = normalizedNewRelations.filter((relation) => !oldMap.has(toRelationKey(relation)));
  const removed = normalizedOldRelations.filter((relation) => !newMap.has(toRelationKey(relation)));

  if (added.length === 0 && removed.length === 0) {
    return;
  }

  const updates: Promise<void>[] = [];

  for (const rel of removed) {
    const relationType = asRelationType(rel.type);
    if (!relationType) continue;
    const inverseType = inverseRelationMap[relationType];
    if (inverseType) {
      const targetRef = doc(db, "users", uid, "entries", rel.targetId);
      updates.push(
        (async () => {
          const targetSnap = await getDoc(targetRef);
          if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            const targetRelations = normalizeRelations(
              Array.isArray(targetData.relations) ? (targetData.relations as RelationInput[]) : [],
            );
            const updatedTargetRelations = targetRelations.filter(
              (tr) => !(tr.targetId === sourceId && !tr.inferred),
            );

            if (updatedTargetRelations.length !== targetRelations.length) {
              await updateDoc(targetRef, {
                relations: updatedTargetRelations.map((relation) => ({
                  targetId: relation.targetId,
                  type: relation.type,
                  createdAtMs: relation.createdAtMs,
                  ...(relation.inferred ? { inferred: true } : {}),
                })),
                updatedAt: serverTimestamp(),
              });
            }
          }
        })(),
      );
    }
  }

  for (const rel of added) {
    const relationType = asRelationType(rel.type);
    if (!relationType) continue;
    const inverseType = inverseRelationMap[relationType];
    if (inverseType) {
      const targetRef = doc(db, "users", uid, "entries", rel.targetId);
      updates.push(
        (async () => {
          const targetSnap = await getDoc(targetRef);
          if (targetSnap.exists()) {
            const targetData = targetSnap.data();
            const targetRelations = normalizeRelations(
              Array.isArray(targetData.relations) ? (targetData.relations as RelationInput[]) : [],
            );
            const pairExplicitRelations = targetRelations.filter(
              (relation) => relation.targetId === sourceId && !relation.inferred,
            );
            const existingExactInverse = pairExplicitRelations.find(
              (relation) => relation.type === inverseType,
            );

            if (pairExplicitRelations.length === 1 && existingExactInverse) {
              return;
            }

            const baseRelations = targetRelations.filter(
              (relation) => !(relation.targetId === sourceId && !relation.inferred),
            );
            const inverseRelation: RelationRecord = {
              targetId: sourceId,
              type: inverseType,
              createdAtMs: existingExactInverse?.createdAtMs ?? Date.now(),
            };
            const nextRelations = normalizeRelations([...baseRelations, inverseRelation]);

            await updateDoc(targetRef, {
              relations: nextRelations.map((relation) => ({
                targetId: relation.targetId,
                type: relation.type,
                createdAtMs: relation.createdAtMs,
                ...(relation.inferred ? { inferred: true } : {}),
              })),
              updatedAt: serverTimestamp(),
            });
          }
        })(),
      );
    }
  }

  await Promise.all(updates);
  await reconcileTransitiveRelations(uid);
};
