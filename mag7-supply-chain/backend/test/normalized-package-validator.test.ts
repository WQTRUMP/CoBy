import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  validateNormalizedPackageDirectory,
  validateNormalizedPackageManifest,
} from "../src/lib/normalized-package-validator.js";

const ROOT_MANIFEST =
  "/workspace/agents/evidence-collector/output/mag7-full-package/mag7-full-package-manifest.json";

function makeRelation(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "mag7-supply-chain.import-relations.v3",
    relation_id: "rel:amazon:astera-labs:component_supply:published-row",
    snapshot_id: "snapshot:2026-06-15.full.18",
    company: "Amazon",
    company_slug: "amazon",
    supplier: "Astera Labs",
    supplier_slug: "astera-labs",
    tier: 1,
    depth_from_mag7: 1,
    relationship_type: "component_supply",
    relationship_subtype: "published_row",
    product_scope: ["AWS"],
    evidence_ids: ["evidence:amazon:astera-labs:published:1"],
    primary_evidence_id: "evidence:amazon:astera-labs:published:1",
    evidence_date: "2026-02-05",
    evidence_date_resolution: "day",
    evidence_excerpt: "Published row.",
    source_url: "https://example.com/published-row",
    confidence_label: "confirmed",
    confidence_score: 0.9,
    source_method: "direct_disclosure",
    source_count: 1,
    status: "approved",
    summary: "Published row.",
    lineage_key: "Amazon|Astera Labs|component_supply|published_row",
    source_report_path: "output/published-row.md",
    last_verified_at: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

function makeEvidence(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "mag7-supply-chain.import-relations.v3",
    evidence_id: "evidence:amazon:astera-labs:published:1",
    relation_id: "rel:amazon:astera-labs:component_supply:published-row",
    source_type: "official_filing",
    title: "Published evidence",
    publisher: "SEC",
    source_url: "https://example.com/published-row",
    source_domain: "sec.gov",
    published_at: "2026-02-05",
    published_at_resolution: "day",
    retrieved_at: "2026-06-15T00:00:00Z",
    excerpt: "Published row.",
    citation_text: "Published row.",
    reliability_tier: 1,
    parser_version: "manual-normalization-v3",
    source_report_path: "output/published-row.md",
    ...overrides,
  };
}

async function writeJsonl(path: string, rows: Record<string, unknown>[]) {
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}

async function createCandidateFixture() {
  const dir = await mkdtemp(join(tmpdir(), "mag7-version-manifest-"));
  const relationsPublished = join(dir, "relations.jsonl");
  const relationsAll = join(dir, "relations-all-candidates.jsonl");
  const evidencePublished = join(dir, "evidence.jsonl");
  const evidenceAll = join(dir, "evidence-all-candidates.jsonl");
  const legacyManifest = join(dir, "mag7-full-package-manifest.json");
  const versionManifest = join(dir, "version-manifest.json");

  const publishedRelation = makeRelation();
  const candidateRelation = makeRelation({
    relation_id: "rel:amazon:sk-hynix:component_supply:candidate-row",
    status: "candidate_only",
    evidence_ids: [
      "evidence:amazon:sk-hynix:candidate:1",
      "evidence:amazon:sk-hynix:candidate:2",
    ],
    primary_evidence_id: "evidence:amazon:sk-hynix:candidate:1",
    supplier: "SK hynix",
    supplier_slug: "sk-hynix",
    relationship_subtype: "candidate_row",
    summary: "Candidate row.",
    notes: "decision=candidate_only",
    source_url: "https://example.com/candidate-row",
    lineage_key: "Amazon|SK hynix|component_supply|candidate_row",
  });

  const publishedEvidence = makeEvidence();
  const candidateEvidenceA = makeEvidence({
    evidence_id: "evidence:amazon:sk-hynix:candidate:1",
    relation_id: "rel:amazon:sk-hynix:component_supply:candidate-row",
    title: "Candidate evidence 1",
    source_url: "https://example.com/candidate-row",
  });
  const candidateEvidenceB = makeEvidence({
    evidence_id: "evidence:amazon:sk-hynix:candidate:2",
    relation_id: "rel:amazon:sk-hynix:component_supply:candidate-row",
    title: "Candidate evidence 2",
    source_url: "https://example.com/candidate-row-2",
  });

  await writeJsonl(relationsPublished, [publishedRelation]);
  await writeJsonl(relationsAll, [publishedRelation, candidateRelation]);
  await writeJsonl(evidencePublished, [publishedEvidence]);
  await writeJsonl(evidenceAll, [publishedEvidence, candidateEvidenceA, candidateEvidenceB]);

  await writeFile(
    legacyManifest,
    JSON.stringify({
      package_snapshot_id: "snapshot:2026-06-15.full.21-tail-closure-candidate",
      authoritative_snapshot: "snapshot:2026-06-15.full.18",
      import_modes: {
        published_view: {
          relation_file: relationsPublished,
          evidence_file: evidencePublished,
          record_counts: {
            relations: 1,
            evidence: 1,
          },
        },
        lossless_import: {
          relation_file: relationsAll,
          evidence_file: evidenceAll,
          record_counts: {
            relations: 2,
            evidence: 3,
          },
        },
      },
      formal_boundary_reconciliation: {
        resolved_counts: {
          candidate_only_delta: {
            relations: 1,
            evidence: 2,
          },
        },
      },
    }),
    "utf8",
  );

  await writeFile(
    versionManifest,
    JSON.stringify({
      schema_version: "mag7-supply-chain.version-manifest.v1",
      package_snapshot_id: "snapshot:2026-06-15.full.21-tail-closure-candidate",
      authoritative_root_snapshot: "snapshot:2026-06-15.full.18",
      published: {
        relation_file: relationsPublished,
        evidence_file: evidencePublished,
        record_counts: {
          relations: 1,
          evidence: 1,
        },
      },
      all_candidates: {
        relation_file: relationsAll,
        evidence_file: evidenceAll,
        record_counts: {
          relations: 2,
          evidence: 3,
        },
      },
      candidate_only: {
        relations: 1,
        evidence: 2,
      },
    }),
    "utf8",
  );

  return {
    dir,
    legacyManifest,
    versionManifest,
    relationsPublished,
    relationsAll,
    evidencePublished,
    evidenceAll,
  };
}

describe("normalized package validator", () => {
  it("validates the current root package against the formal 332/444, 335/448, 3/4 boundary", async () => {
    const summary = await validateNormalizedPackageManifest(ROOT_MANIFEST);

    expect(summary).toMatchObject({
      schemaVersion: "mag7-supply-chain.import-relations.v3",
      published: {
        relations: 332,
        evidence: 444,
      },
      allCandidates: {
        relations: 335,
        evidence: 448,
      },
      candidateOnly: {
        relations: 3,
        evidence: 4,
      },
    });
    expect(summary.manifest.authoritativeRootSnapshot).toBe("snapshot:2026-06-15.full.18");
  });

  it("rejects candidate packages that do not ship version-manifest.json", async () => {
    const fixture = await createCandidateFixture();

    try {
      await rm(fixture.versionManifest);
      await expect(validateNormalizedPackageDirectory(fixture.dir)).rejects.toThrow(
        /missing version-manifest\.json/i,
      );
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("rejects mixed-schema raw files", async () => {
    const fixture = await createCandidateFixture();

    try {
      await writeJsonl(fixture.relationsAll, [
        makeRelation(),
        makeRelation({
          relation_id: "rel:amazon:sk-hynix:component_supply:mixed-schema-row",
          status: "candidate_only",
          schema_version: "mag7-supply-chain.import-relations.v2",
          evidence_ids: ["evidence:amazon:sk-hynix:mixed:1"],
          primary_evidence_id: "evidence:amazon:sk-hynix:mixed:1",
        }),
      ]);

      await expect(validateNormalizedPackageDirectory(fixture.dir)).rejects.toThrow(/mixed schema_version/i);
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("rejects manifest line count mismatches", async () => {
    const fixture = await createCandidateFixture();

    try {
      await writeFile(
        fixture.versionManifest,
        JSON.stringify({
          schema_version: "mag7-supply-chain.version-manifest.v1",
          package_snapshot_id: "snapshot:2026-06-15.full.21-tail-closure-candidate",
          authoritative_root_snapshot: "snapshot:2026-06-15.full.18",
          published: {
            relation_file: fixture.relationsPublished,
            evidence_file: fixture.evidencePublished,
            record_counts: {
              relations: 2,
              evidence: 1,
            },
          },
          all_candidates: {
            relation_file: fixture.relationsAll,
            evidence_file: fixture.evidenceAll,
            record_counts: {
              relations: 2,
              evidence: 3,
            },
          },
          candidate_only: {
            relations: 1,
            evidence: 2,
          },
        }),
        "utf8",
      );

      await expect(validateNormalizedPackageDirectory(fixture.dir)).rejects.toThrow(/Published relation count mismatch/i);
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("rejects candidate-only rows leaking into published files", async () => {
    const fixture = await createCandidateFixture();

    try {
      await writeJsonl(fixture.relationsPublished, [
        makeRelation({
          relation_id: "rel:amazon:sk-hynix:component_supply:leaked-candidate-row",
          status: "candidate_only",
          evidence_ids: ["evidence:amazon:sk-hynix:leaked:1"],
          primary_evidence_id: "evidence:amazon:sk-hynix:leaked:1",
          supplier: "SK hynix",
          supplier_slug: "sk-hynix",
        }),
      ]);

      await expect(validateNormalizedPackageDirectory(fixture.dir)).rejects.toThrow(
        /Published relations contain candidate_only rows/i,
      );
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });
});
