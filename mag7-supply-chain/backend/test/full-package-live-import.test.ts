import { describe, expect, it } from "vitest";

import {
  resolveFullPackageLiveImportSpec,
  validateFullPackageLiveImportSpec,
} from "../src/lib/full-package-live-import.js";

const FULL_PACKAGE_MANIFEST =
  "/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json";

describe("full-package live import manifest", () => {
  it("resolves the root full20-wave5 published view while keeping authoritative snapshot pinned to full.18", async () => {
    const spec = await resolveFullPackageLiveImportSpec(FULL_PACKAGE_MANIFEST, "published");

    expect(spec).toMatchObject({
      manifestPath: FULL_PACKAGE_MANIFEST,
      mode: "published",
      packageSnapshotId: "snapshot:2026-06-15.full.20-wave5-candidate",
      authoritativeSnapshotId: "snapshot:2026-06-15.full.18",
      expectedRelationCount: 332,
      expectedEvidenceCount: 444,
      candidateOnlyRelationCount: 9,
      candidateOnlyEvidenceCount: 15,
    });
    expect(spec.relationFile).toBe("/workspace/agents/evidence-collector/output/mag7-full-package/relations.jsonl");
    expect(spec.evidenceFile).toBe("/workspace/agents/evidence-collector/output/mag7-full-package/evidence.jsonl");

    const counts = await validateFullPackageLiveImportSpec(spec);
    expect(counts).toEqual({
      actualRelationCount: 332,
      actualEvidenceCount: 444,
    });
  });

  it("resolves the root full20-wave5 all-candidates view with the 9/15 candidate-only delta intact", async () => {
    const spec = await resolveFullPackageLiveImportSpec(FULL_PACKAGE_MANIFEST, "all-candidates");

    expect(spec).toMatchObject({
      mode: "all-candidates",
      packageSnapshotId: "snapshot:2026-06-15.full.20-wave5-candidate",
      authoritativeSnapshotId: "snapshot:2026-06-15.full.18",
      expectedRelationCount: 341,
      expectedEvidenceCount: 459,
      candidateOnlyRelationCount: 9,
      candidateOnlyEvidenceCount: 15,
    });
    expect(spec.relationFile).toBe(
      "/workspace/agents/evidence-collector/output/mag7-full-package/relations-all-candidates.jsonl",
    );
    expect(spec.evidenceFile).toBe(
      "/workspace/agents/evidence-collector/output/mag7-full-package/evidence-all-candidates.jsonl",
    );

    const counts = await validateFullPackageLiveImportSpec(spec);
    expect(counts).toEqual({
      actualRelationCount: 341,
      actualEvidenceCount: 459,
    });
  });
});
