import { readFile } from "node:fs/promises";

import { loadVersionManifestFromLegacyRootManifest } from "./version-manifest.js";

export type FullPackageImportMode = "published" | "all-candidates";

export interface FullPackageLiveImportSpec {
  manifestPath: string;
  mode: FullPackageImportMode;
  relationFile: string;
  evidenceFile: string;
  expectedRelationCount: number;
  expectedEvidenceCount: number;
  packageSnapshotId: string;
  authoritativeSnapshotId: string;
  candidateOnlyRelationCount: number;
  candidateOnlyEvidenceCount: number;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid full package manifest: missing ${field}`);
  }

  return value;
}

function assertCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid full package manifest: missing ${field}`);
  }

  return value;
}

function countJsonlRows(contents: string) {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export async function resolveFullPackageLiveImportSpec(
  manifestPath: string,
  mode: FullPackageImportMode,
): Promise<FullPackageLiveImportSpec> {
  const manifest = await loadVersionManifestFromLegacyRootManifest(manifestPath);
  const modeConfig = mode === "published" ? manifest.published : manifest.allCandidates;

  return {
    manifestPath,
    mode,
    relationFile: assertString(modeConfig.relationFile, `${mode}.relation_file`),
    evidenceFile: assertString(modeConfig.evidenceFile, `${mode}.evidence_file`),
    expectedRelationCount: assertCount(modeConfig.relationCount, `${mode}.record_counts.relations`),
    expectedEvidenceCount: assertCount(modeConfig.evidenceCount, `${mode}.record_counts.evidence`),
    packageSnapshotId: manifest.packageSnapshotId,
    authoritativeSnapshotId: manifest.authoritativeRootSnapshot,
    candidateOnlyRelationCount: assertCount(manifest.candidateOnly.relations, "candidate_only.relations"),
    candidateOnlyEvidenceCount: assertCount(manifest.candidateOnly.evidence, "candidate_only.evidence"),
  };
}

export async function validateFullPackageLiveImportSpec(spec: FullPackageLiveImportSpec) {
  const [relationsRaw, evidenceRaw] = await Promise.all([
    readFile(spec.relationFile, "utf8"),
    readFile(spec.evidenceFile, "utf8"),
  ]);

  const actualRelationCount = countJsonlRows(relationsRaw);
  const actualEvidenceCount = countJsonlRows(evidenceRaw);

  if (actualRelationCount !== spec.expectedRelationCount) {
    throw new Error(
      `Full package relation count mismatch for ${spec.mode}: expected ${spec.expectedRelationCount}, got ${actualRelationCount}`,
    );
  }

  if (actualEvidenceCount !== spec.expectedEvidenceCount) {
    throw new Error(
      `Full package evidence count mismatch for ${spec.mode}: expected ${spec.expectedEvidenceCount}, got ${actualEvidenceCount}`,
    );
  }

  return {
    actualRelationCount,
    actualEvidenceCount,
  };
}
