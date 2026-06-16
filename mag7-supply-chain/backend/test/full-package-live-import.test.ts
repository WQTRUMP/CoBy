import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveFullPackageLiveImportSpec,
  validateFullPackageLiveImportSpec,
} from "../src/lib/full-package-live-import.js";

const FULL_PACKAGE_MANIFEST =
  "/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json";

async function createBaselineDriftFixture() {
  const dir = await mkdtemp(join(tmpdir(), "mag7-live-import-drift-"));
  const manifestPath = join(dir, "mag7-full-package-manifest.json");
  const versionManifestPath = join(dir, "version-manifest.json");
  const relationsPath = join(dir, "relations.jsonl");
  const evidencePath = join(dir, "evidence.jsonl");
  const relationsAllPath = join(dir, "relations-all-candidates.jsonl");
  const evidenceAllPath = join(dir, "evidence-all-candidates.jsonl");
  const relationRow =
    '{"schema_version":"mag7-supply-chain.import-relations.v3","relation_id":"rel:test","snapshot_id":"snapshot:2026-06-15.full.18","status":"approved"}\n';
  const evidenceRow =
    '{"schema_version":"mag7-supply-chain.import-relations.v3","evidence_id":"evidence:test","relation_id":"rel:test"}\n';

  await writeFile(relationsPath, relationRow, "utf8");
  await writeFile(evidencePath, evidenceRow, "utf8");
  await writeFile(relationsAllPath, relationRow, "utf8");
  await writeFile(evidenceAllPath, evidenceRow, "utf8");

  await writeFile(
    manifestPath,
    JSON.stringify({
      package_snapshot_id: "snapshot:2026-06-15.full.20-wave5-candidate",
      authoritative_snapshot: "snapshot:2026-06-15.full.18",
      import_modes: {
        published_view: {
          relation_file: relationsPath,
          evidence_file: evidencePath,
          record_counts: { relations: 1, evidence: 1 },
        },
        lossless_import: {
          relation_file: relationsAllPath,
          evidence_file: evidenceAllPath,
          record_counts: { relations: 1, evidence: 1 },
        },
      },
      formal_boundary_reconciliation: {
        resolved_counts: {
          candidate_only_delta: { relations: 0, evidence: 0 },
        },
      },
    }),
    "utf8",
  );

  await writeFile(
    versionManifestPath,
    JSON.stringify({
      schema_version: "mag7-supply-chain.version-manifest.v1",
      package_snapshot_id: "snapshot:2026-06-15.full.20-wave5-candidate",
      authoritative_root_snapshot: "snapshot:2026-06-15.full.18",
      published: {
        relation_file: relationsPath,
        evidence_file: evidencePath,
        record_counts: { relations: 1, evidence: 1 },
      },
      all_candidates: {
        relation_file: relationsAllPath,
        evidence_file: evidenceAllPath,
        record_counts: { relations: 1, evidence: 1 },
      },
      candidate_only: { relations: 0, evidence: 0 },
    }),
    "utf8",
  );

  return { dir, manifestPath };
}

describe("full-package live import manifest", () => {
  it("resolves the root full21 tail-closure published view while keeping authoritative snapshot pinned to full.18", async () => {
    const spec = await resolveFullPackageLiveImportSpec(FULL_PACKAGE_MANIFEST, "published");

    expect(spec).toMatchObject({
      manifestPath: FULL_PACKAGE_MANIFEST,
      mode: "published",
      packageSnapshotId: "snapshot:2026-06-15.full.21-tail-closure-candidate",
      authoritativeSnapshotId: "snapshot:2026-06-15.full.18",
      expectedRelationCount: 332,
      expectedEvidenceCount: 444,
      candidateOnlyRelationCount: 3,
      candidateOnlyEvidenceCount: 4,
    });
    expect(spec.governance).toMatchObject({
      authoritativeSnapshot: "snapshot:2026-06-15.full.18",
      activeCandidateShell: "snapshot:2026-06-15.full.21-tail-closure-candidate",
      realDataLaunch: {
        status: "awaiting_source_neo4j_positive_closure",
        allowedToAdvance: false,
        blockingGate: "source_neo4j_positive_closure",
      },
    });
    expect(spec.relationFile).toBe("/workspace/agents/evidence-collector/output/mag7-full-package/relations.jsonl");
    expect(spec.evidenceFile).toBe("/workspace/agents/evidence-collector/output/mag7-full-package/evidence.jsonl");

    const counts = await validateFullPackageLiveImportSpec(spec);
    expect(counts).toEqual({
      actualRelationCount: 332,
      actualEvidenceCount: 444,
    });
  });

  it("resolves the root full21 tail-closure all-candidates view with the 3/4 candidate-only delta intact", async () => {
    const spec = await resolveFullPackageLiveImportSpec(FULL_PACKAGE_MANIFEST, "all-candidates");

    expect(spec).toMatchObject({
      mode: "all-candidates",
      packageSnapshotId: "snapshot:2026-06-15.full.21-tail-closure-candidate",
      authoritativeSnapshotId: "snapshot:2026-06-15.full.18",
      expectedRelationCount: 335,
      expectedEvidenceCount: 448,
      candidateOnlyRelationCount: 3,
      candidateOnlyEvidenceCount: 4,
    });
    expect(spec.relationFile).toBe(
      "/workspace/agents/evidence-collector/output/mag7-full-package/relations-all-candidates.jsonl",
    );
    expect(spec.evidenceFile).toBe(
      "/workspace/agents/evidence-collector/output/mag7-full-package/evidence-all-candidates.jsonl",
    );

    const counts = await validateFullPackageLiveImportSpec(spec);
    expect(counts).toEqual({
      actualRelationCount: 335,
      actualEvidenceCount: 448,
    });
  });

  it("rejects live import manifests that are self-consistent but drift from the formal governance baseline", async () => {
    const fixture = await createBaselineDriftFixture();

    try {
      await expect(resolveFullPackageLiveImportSpec(fixture.manifestPath, "published")).rejects.toThrow(
        /Formal governance baseline mismatch for package_snapshot_id/i,
      );
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });
});
