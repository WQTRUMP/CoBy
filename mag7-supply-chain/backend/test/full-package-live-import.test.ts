import { describe, expect, it } from "vitest";

import {
  resolveFullPackageLiveImportSpec,
  validateFullPackageLiveImportSpec,
} from "../src/lib/full-package-live-import.js";

const FULL_PACKAGE_MANIFEST =
  "/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json";

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
});
