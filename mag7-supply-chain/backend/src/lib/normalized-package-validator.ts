import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  loadVersionManifestFromLegacyRootManifest,
  resolveVersionManifestFromPackageDir,
  type VersionManifest,
} from "./version-manifest.js";

interface RelationLikeRow {
  relation_id?: unknown;
  snapshot_id?: unknown;
  schema_version?: unknown;
  status?: unknown;
  notes?: unknown;
  evidence_ids?: unknown;
}

interface EvidenceLikeRow {
  evidence_id?: unknown;
  relation_id?: unknown;
  schema_version?: unknown;
}

interface JsonlInspection<Row> {
  rows: Row[];
  count: number;
  schemaVersions: string[];
}

export interface NormalizedPackageValidationSummary {
  manifest: VersionManifest;
  schemaVersion: string;
  published: {
    relations: number;
    evidence: number;
  };
  allCandidates: {
    relations: number;
    evidence: number;
  };
  candidateOnly: {
    relations: number;
    evidence: number;
    relationIds: string[];
    evidenceIds: string[];
  };
}

function assertNoMixedSchema(label: string, schemaVersions: string[]) {
  if (schemaVersions.length !== 1) {
    throw new Error(`${label} contains mixed schema_version values: ${schemaVersions.join(", ")}`);
  }
}

async function inspectJsonl<Row>(filePath: string): Promise<JsonlInspection<Row>> {
  const contents = await readFile(filePath, "utf8");
  const rows = contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);
  const schemaVersions = [...new Set(
    rows
      .map((row) => {
        const value = (row as { schema_version?: unknown }).schema_version;
        return typeof value === "string" ? value : "(missing)";
      })
      .sort(),
  )];

  return {
    rows,
    count: rows.length,
    schemaVersions,
  };
}

function assertCount(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label} count mismatch: expected ${expected}, got ${actual}`);
  }
}

function relationIdSet(rows: RelationLikeRow[]) {
  return new Set(
    rows
      .map((row) => (typeof row.relation_id === "string" ? row.relation_id : null))
      .filter((value): value is string => value !== null),
  );
}

function evidenceIdSet(rows: EvidenceLikeRow[]) {
  return new Set(
    rows
      .map((row) => (typeof row.evidence_id === "string" ? row.evidence_id : null))
      .filter((value): value is string => value !== null),
  );
}

function diffById<Row extends Record<"relation_id" | "evidence_id", unknown>>(
  superset: Row[],
  subsetIds: Set<string>,
  idKey: "relation_id" | "evidence_id",
) {
  return superset.filter((row) => {
    const id = row[idKey];
    return typeof id === "string" && !subsetIds.has(id);
  });
}

function assertPublishedRelationsClean(rows: RelationLikeRow[]) {
  const leaked = rows.filter((row) => row.status === "candidate_only");
  if (leaked.length > 0) {
    throw new Error(
      `Published relations contain candidate_only rows: ${leaked
        .map((row) => row.relation_id)
        .filter((id): id is string => typeof id === "string")
        .join(", ")}`,
    );
  }
}

function assertPublishedEvidenceClean(rows: EvidenceLikeRow[], candidateRelationIds: Set<string>) {
  const leaked = rows.filter(
    (row) => typeof row.relation_id === "string" && candidateRelationIds.has(row.relation_id),
  );
  if (leaked.length > 0) {
    throw new Error(
      `Published evidence references candidate-only relations: ${leaked
        .map((row) => row.evidence_id)
        .filter((id): id is string => typeof id === "string")
        .join(", ")}`,
    );
  }
}

function assertCandidateOnlyRelations(rows: RelationLikeRow[]) {
  const bad = rows.filter((row) => row.status !== "candidate_only");
  if (bad.length > 0) {
    throw new Error(
      `All-candidates relation delta contains non-candidate_only rows: ${bad
        .map((row) => row.relation_id)
        .filter((id): id is string => typeof id === "string")
        .join(", ")}`,
    );
  }
}

function assertCandidateOnlyEvidence(rows: EvidenceLikeRow[], candidateRelationIds: Set<string>) {
  const bad = rows.filter(
    (row) => typeof row.relation_id !== "string" || !candidateRelationIds.has(row.relation_id),
  );
  if (bad.length > 0) {
    throw new Error(
      `All-candidates evidence delta is not scoped to candidate-only relations: ${bad
        .map((row) => row.evidence_id)
        .filter((id): id is string => typeof id === "string")
        .join(", ")}`,
    );
  }
}

async function validateAgainstVersionManifest(manifest: VersionManifest): Promise<NormalizedPackageValidationSummary> {
  const [publishedRelations, publishedEvidence, allRelations, allEvidence] = await Promise.all([
    inspectJsonl<RelationLikeRow>(manifest.published.relationFile),
    inspectJsonl<EvidenceLikeRow>(manifest.published.evidenceFile),
    inspectJsonl<RelationLikeRow>(manifest.allCandidates.relationFile),
    inspectJsonl<EvidenceLikeRow>(manifest.allCandidates.evidenceFile),
  ]);

  assertNoMixedSchema("Published relations", publishedRelations.schemaVersions);
  assertNoMixedSchema("Published evidence", publishedEvidence.schemaVersions);
  assertNoMixedSchema("All-candidates relations", allRelations.schemaVersions);
  assertNoMixedSchema("All-candidates evidence", allEvidence.schemaVersions);

  const schemaVersion = publishedRelations.schemaVersions[0] ?? "(missing)";
  if (
    schemaVersion !== allRelations.schemaVersions[0] ||
    schemaVersion !== publishedEvidence.schemaVersions[0] ||
    schemaVersion !== allEvidence.schemaVersions[0]
  ) {
    throw new Error(
      `Normalized package contains mixed schema_version values across raw files: ${[
        publishedRelations.schemaVersions[0],
        publishedEvidence.schemaVersions[0],
        allRelations.schemaVersions[0],
        allEvidence.schemaVersions[0],
      ].join(", ")}`,
    );
  }

  assertCount("Published relation", publishedRelations.count, manifest.published.relationCount);
  assertCount("Published evidence", publishedEvidence.count, manifest.published.evidenceCount);
  assertCount("All-candidates relation", allRelations.count, manifest.allCandidates.relationCount);
  assertCount("All-candidates evidence", allEvidence.count, manifest.allCandidates.evidenceCount);

  const publishedRelationIds = relationIdSet(publishedRelations.rows);
  const publishedEvidenceIds = evidenceIdSet(publishedEvidence.rows);
  const candidateOnlyRelations = diffById(
    allRelations.rows as Array<RelationLikeRow & Record<"relation_id" | "evidence_id", unknown>>,
    publishedRelationIds,
    "relation_id",
  );
  const candidateOnlyEvidence = diffById(
    allEvidence.rows as Array<EvidenceLikeRow & Record<"relation_id" | "evidence_id", unknown>>,
    publishedEvidenceIds,
    "evidence_id",
  );
  const candidateOnlyRelationIds = relationIdSet(candidateOnlyRelations);

  assertPublishedRelationsClean(publishedRelations.rows);
  assertCandidateOnlyRelations(candidateOnlyRelations);
  assertPublishedEvidenceClean(publishedEvidence.rows, candidateOnlyRelationIds);
  assertCandidateOnlyEvidence(candidateOnlyEvidence, candidateOnlyRelationIds);

  assertCount(
    "Candidate-only relation delta",
    candidateOnlyRelations.length,
    manifest.candidateOnly.relations,
  );
  assertCount(
    "Candidate-only evidence delta",
    candidateOnlyEvidence.length,
    manifest.candidateOnly.evidence,
  );

  return {
    manifest,
    schemaVersion,
    published: {
      relations: publishedRelations.count,
      evidence: publishedEvidence.count,
    },
    allCandidates: {
      relations: allRelations.count,
      evidence: allEvidence.count,
    },
    candidateOnly: {
      relations: candidateOnlyRelations.length,
      evidence: candidateOnlyEvidence.length,
      relationIds: [...candidateOnlyRelationIds],
      evidenceIds: candidateOnlyEvidence
        .map((row) => row.evidence_id)
        .filter((id): id is string => typeof id === "string"),
    },
  };
}

export async function validateNormalizedPackageManifest(
  manifestPath: string,
): Promise<NormalizedPackageValidationSummary> {
  const manifest = await loadVersionManifestFromLegacyRootManifest(manifestPath);
  return validateAgainstVersionManifest(manifest);
}

export async function validateNormalizedPackageDirectory(
  packageDir: string,
): Promise<NormalizedPackageValidationSummary> {
  const manifest = await resolveVersionManifestFromPackageDir(packageDir);
  return validateAgainstVersionManifest(manifest);
}

export function inferPackageDirFromManifestPath(manifestPath: string) {
  return dirname(manifestPath);
}

export function buildVersionManifestPath(packageDir: string) {
  return join(packageDir, "version-manifest.json");
}
