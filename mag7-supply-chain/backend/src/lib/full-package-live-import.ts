import { readFile } from "node:fs/promises";

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

interface ManifestRecordCounts {
  relations?: number;
  evidence?: number;
}

interface FullPackageManifest {
  package_snapshot_id?: string;
  authoritative_snapshot?: string;
  import_modes?: {
    published_view?: {
      relation_file?: string;
      evidence_file?: string;
      record_counts?: ManifestRecordCounts;
    };
    lossless_import?: {
      relation_file?: string;
      evidence_file?: string;
      record_counts?: ManifestRecordCounts;
    };
  };
  formal_boundary_reconciliation?: {
    resolved_counts?: {
      candidate_only_delta?: ManifestRecordCounts;
    };
  };
  coverage_summary?: {
    candidate_only_totals?: ManifestRecordCounts;
  };
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
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FullPackageManifest;
  const packageSnapshotId = assertString(manifest.package_snapshot_id, "package_snapshot_id");
  const authoritativeSnapshotId = assertString(manifest.authoritative_snapshot, "authoritative_snapshot");
  const modeConfig =
    mode === "published" ? manifest.import_modes?.published_view : manifest.import_modes?.lossless_import;

  if (!modeConfig) {
    throw new Error(`Invalid full package manifest: missing import_modes.${mode === "published" ? "published_view" : "lossless_import"}`);
  }

  const relationFile = assertString(modeConfig.relation_file, `${mode}.relation_file`);
  const evidenceFile = assertString(modeConfig.evidence_file, `${mode}.evidence_file`);
  const expectedRelationCount = assertCount(modeConfig.record_counts?.relations, `${mode}.record_counts.relations`);
  const expectedEvidenceCount = assertCount(modeConfig.record_counts?.evidence, `${mode}.record_counts.evidence`);
  const candidateOnlyRelationCount =
    manifest.formal_boundary_reconciliation?.resolved_counts?.candidate_only_delta?.relations ??
    manifest.coverage_summary?.candidate_only_totals?.relations;
  const candidateOnlyEvidenceCount =
    manifest.formal_boundary_reconciliation?.resolved_counts?.candidate_only_delta?.evidence ??
    manifest.coverage_summary?.candidate_only_totals?.evidence;

  return {
    manifestPath,
    mode,
    relationFile,
    evidenceFile,
    expectedRelationCount,
    expectedEvidenceCount,
    packageSnapshotId,
    authoritativeSnapshotId,
    candidateOnlyRelationCount: assertCount(
      candidateOnlyRelationCount,
      "formal_boundary_reconciliation.resolved_counts.candidate_only_delta.relations",
    ),
    candidateOnlyEvidenceCount: assertCount(
      candidateOnlyEvidenceCount,
      "formal_boundary_reconciliation.resolved_counts.candidate_only_delta.evidence",
    ),
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
