import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export type VersionManifestMode = "published" | "all-candidates";

export interface VersionManifestFileBoundary {
  relationFile: string;
  evidenceFile: string;
  relationCount: number;
  evidenceCount: number;
}

export interface VersionManifest {
  schemaVersion: "mag7-supply-chain.version-manifest.v1";
  packageSnapshotId: string;
  authoritativeRootSnapshot: string;
  published: VersionManifestFileBoundary;
  allCandidates: VersionManifestFileBoundary;
  candidateOnly: {
    relations: number;
    evidence: number;
  };
  source: "legacy_root_manifest" | "version_manifest";
  sourcePath: string;
}

interface LegacyRootManifest {
  package_snapshot_id?: unknown;
  authoritative_snapshot?: unknown;
  import_modes?: {
    published_view?: {
      relation_file?: unknown;
      evidence_file?: unknown;
      record_counts?: {
        relations?: unknown;
        evidence?: unknown;
      };
    };
    lossless_import?: {
      relation_file?: unknown;
      evidence_file?: unknown;
      record_counts?: {
        relations?: unknown;
        evidence?: unknown;
      };
    };
  };
  formal_boundary_reconciliation?: {
    resolved_counts?: {
      candidate_only_delta?: {
        relations?: unknown;
        evidence?: unknown;
      };
    };
  };
  coverage_summary?: {
    candidate_only_totals?: {
      relations?: unknown;
      evidence?: unknown;
    };
  };
}

interface ExplicitVersionManifest {
  schema_version?: unknown;
  package_snapshot_id?: unknown;
  authoritative_root_snapshot?: unknown;
  published?: {
    relation_file?: unknown;
    evidence_file?: unknown;
    record_counts?: {
      relations?: unknown;
      evidence?: unknown;
    };
  };
  all_candidates?: {
    relation_file?: unknown;
    evidence_file?: unknown;
    record_counts?: {
      relations?: unknown;
      evidence?: unknown;
    };
  };
  candidate_only?: {
    relations?: unknown;
    evidence?: unknown;
  };
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid version manifest: missing ${field}`);
  }

  return value;
}

function assertCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid version manifest: missing ${field}`);
  }

  return value;
}

function parseBoundary(
  boundary: {
    relation_file?: unknown;
    evidence_file?: unknown;
    record_counts?: {
      relations?: unknown;
      evidence?: unknown;
    };
  } | undefined,
  field: string,
): VersionManifestFileBoundary {
  if (!boundary) {
    throw new Error(`Invalid version manifest: missing ${field}`);
  }

  return {
    relationFile: assertString(boundary.relation_file, `${field}.relation_file`),
    evidenceFile: assertString(boundary.evidence_file, `${field}.evidence_file`),
    relationCount: assertCount(boundary.record_counts?.relations, `${field}.record_counts.relations`),
    evidenceCount: assertCount(boundary.record_counts?.evidence, `${field}.record_counts.evidence`),
  };
}

function inferCandidateOnlyCounts(manifest: LegacyRootManifest) {
  const relations =
    manifest.formal_boundary_reconciliation?.resolved_counts?.candidate_only_delta?.relations ??
    manifest.coverage_summary?.candidate_only_totals?.relations;
  const evidence =
    manifest.formal_boundary_reconciliation?.resolved_counts?.candidate_only_delta?.evidence ??
    manifest.coverage_summary?.candidate_only_totals?.evidence;

  return {
    relations: assertCount(
      relations,
      "formal_boundary_reconciliation.resolved_counts.candidate_only_delta.relations",
    ),
    evidence: assertCount(
      evidence,
      "formal_boundary_reconciliation.resolved_counts.candidate_only_delta.evidence",
    ),
  };
}

export async function loadVersionManifestFromLegacyRootManifest(
  manifestPath: string,
): Promise<VersionManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as LegacyRootManifest;

  return {
    schemaVersion: "mag7-supply-chain.version-manifest.v1",
    packageSnapshotId: assertString(manifest.package_snapshot_id, "package_snapshot_id"),
    authoritativeRootSnapshot: assertString(manifest.authoritative_snapshot, "authoritative_snapshot"),
    published: parseBoundary(manifest.import_modes?.published_view, "import_modes.published_view"),
    allCandidates: parseBoundary(manifest.import_modes?.lossless_import, "import_modes.lossless_import"),
    candidateOnly: inferCandidateOnlyCounts(manifest),
    source: "legacy_root_manifest",
    sourcePath: manifestPath,
  };
}

export async function loadVersionManifestFile(versionManifestPath: string): Promise<VersionManifest> {
  const manifest = JSON.parse(await readFile(versionManifestPath, "utf8")) as ExplicitVersionManifest;
  const schemaVersion = assertString(manifest.schema_version, "schema_version");
  if (schemaVersion !== "mag7-supply-chain.version-manifest.v1") {
    throw new Error(`Invalid version manifest: unsupported schema_version ${schemaVersion}`);
  }

  return {
    schemaVersion: "mag7-supply-chain.version-manifest.v1",
    packageSnapshotId: assertString(manifest.package_snapshot_id, "package_snapshot_id"),
    authoritativeRootSnapshot: assertString(
      manifest.authoritative_root_snapshot,
      "authoritative_root_snapshot",
    ),
    published: parseBoundary(manifest.published, "published"),
    allCandidates: parseBoundary(manifest.all_candidates, "all_candidates"),
    candidateOnly: {
      relations: assertCount(manifest.candidate_only?.relations, "candidate_only.relations"),
      evidence: assertCount(manifest.candidate_only?.evidence, "candidate_only.evidence"),
    },
    source: "version_manifest",
    sourcePath: versionManifestPath,
  };
}

export function isCandidateVersionManifest(manifest: VersionManifest) {
  return manifest.packageSnapshotId !== manifest.authoritativeRootSnapshot;
}

export async function resolveVersionManifestFromPackageDir(packageDir: string): Promise<VersionManifest> {
  const legacyManifestPath = join(packageDir, "mag7-full-package-manifest.json");
  const legacyManifest = await loadVersionManifestFromLegacyRootManifest(legacyManifestPath);
  const versionManifestPath = join(packageDir, "version-manifest.json");

  try {
    await access(versionManifestPath);
    return await loadVersionManifestFile(versionManifestPath);
  } catch (error) {
    if (isCandidateVersionManifest(legacyManifest)) {
      throw new Error(
        `Candidate package is missing version-manifest.json: ${packageDir}`,
      );
    }

    return legacyManifest;
  }
}
