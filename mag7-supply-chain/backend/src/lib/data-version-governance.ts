import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { VersionManifest } from "./version-manifest.js";

interface FormalDataVersionManifestFile {
  release?: {
    authoritative_snapshot?: unknown;
    active_candidate_shell?: unknown;
    real_data_launch?: {
      status?: unknown;
      allowed_to_advance?: unknown;
      blocking_gate?: unknown;
    };
  };
  counts?: {
    published?: {
      relations?: unknown;
      evidence?: unknown;
    };
    all_candidates?: {
      relations?: unknown;
      evidence?: unknown;
    };
    candidate_only?: {
      relations?: unknown;
      evidence?: unknown;
    };
  };
}

export interface FormalGovernanceBaseline {
  sourcePath: string;
  authoritativeSnapshot: string;
  activeCandidateShell: string;
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
  };
  realDataLaunch: {
    status: string;
    allowedToAdvance: boolean;
    blockingGate: string;
  };
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_FORMAL_GOVERNANCE_MANIFEST_PATH = join(
  CURRENT_DIR,
  "../../../infra/data-governance/data-version-manifest.json",
);

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid data version governance manifest: missing ${field}`);
  }

  return value;
}

function assertCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid data version governance manifest: missing ${field}`);
  }

  return value;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid data version governance manifest: missing ${field}`);
  }

  return value;
}

export async function loadFormalGovernanceBaseline(
  manifestPath = DEFAULT_FORMAL_GOVERNANCE_MANIFEST_PATH,
): Promise<FormalGovernanceBaseline> {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FormalDataVersionManifestFile;

  return {
    sourcePath: manifestPath,
    authoritativeSnapshot: assertString(
      manifest.release?.authoritative_snapshot,
      "release.authoritative_snapshot",
    ),
    activeCandidateShell: assertString(
      manifest.release?.active_candidate_shell,
      "release.active_candidate_shell",
    ),
    published: {
      relations: assertCount(manifest.counts?.published?.relations, "counts.published.relations"),
      evidence: assertCount(manifest.counts?.published?.evidence, "counts.published.evidence"),
    },
    allCandidates: {
      relations: assertCount(
        manifest.counts?.all_candidates?.relations,
        "counts.all_candidates.relations",
      ),
      evidence: assertCount(
        manifest.counts?.all_candidates?.evidence,
        "counts.all_candidates.evidence",
      ),
    },
    candidateOnly: {
      relations: assertCount(
        manifest.counts?.candidate_only?.relations,
        "counts.candidate_only.relations",
      ),
      evidence: assertCount(
        manifest.counts?.candidate_only?.evidence,
        "counts.candidate_only.evidence",
      ),
    },
    realDataLaunch: {
      status: assertString(manifest.release?.real_data_launch?.status, "release.real_data_launch.status"),
      allowedToAdvance: assertBoolean(
        manifest.release?.real_data_launch?.allowed_to_advance,
        "release.real_data_launch.allowed_to_advance",
      ),
      blockingGate: assertString(
        manifest.release?.real_data_launch?.blocking_gate,
        "release.real_data_launch.blocking_gate",
      ),
    },
  };
}

function assertMatch(label: string, actual: string | number, expected: string | number) {
  if (actual !== expected) {
    throw new Error(
      `Formal governance baseline mismatch for ${label}: expected ${expected}, got ${actual}`,
    );
  }
}

export function assertVersionManifestMatchesGovernanceBaseline(
  manifest: VersionManifest,
  baseline: FormalGovernanceBaseline,
) {
  assertMatch(
    "authoritative_root_snapshot",
    manifest.authoritativeRootSnapshot,
    baseline.authoritativeSnapshot,
  );
  assertMatch("package_snapshot_id", manifest.packageSnapshotId, baseline.activeCandidateShell);
  assertMatch("published.relations", manifest.published.relationCount, baseline.published.relations);
  assertMatch("published.evidence", manifest.published.evidenceCount, baseline.published.evidence);
  assertMatch(
    "all_candidates.relations",
    manifest.allCandidates.relationCount,
    baseline.allCandidates.relations,
  );
  assertMatch(
    "all_candidates.evidence",
    manifest.allCandidates.evidenceCount,
    baseline.allCandidates.evidence,
  );
  assertMatch("candidate_only.relations", manifest.candidateOnly.relations, baseline.candidateOnly.relations);
  assertMatch("candidate_only.evidence", manifest.candidateOnly.evidence, baseline.candidateOnly.evidence);
}
