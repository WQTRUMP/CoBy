import { describe, expect, it } from "vitest";

import { prepareNormalizedImport } from "../src/lib/normalized-package.js";

describe("prepareNormalizedImport", () => {
  it("preserves lossless normalized fields while splitting relation and evidence bindings into graph edges", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:apple:tsmc:manufacturing:apple-silicon",
          snapshot_id: "snapshot:2026-06-14.1",
          company: "Apple",
          company_slug: "apple",
          supplier: "TSMC",
          supplier_slug: "tsmc",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "manufacturing",
          relationship_subtype: "wafer_foundry",
          product_scope: ["Apple silicon", "A-series"],
          evidence_ids: ["evidence:apple:tsmc:1", "evidence:apple:tsmc:2"],
          primary_evidence_id: "evidence:apple:tsmc:1",
          evidence_date: "2025-08-06",
          evidence_date_resolution: "day",
          evidence_excerpt: "TSMC in Arizona is producing chips for Apple.",
          source_url: "https://example.com/apple-tsmc",
          confidence_label: "confirmed",
          confidence_score: 0.96,
          source_method: "direct_disclosure",
          source_count: 2,
          status: "approved",
          summary: "TSMC manufactures Apple silicon.",
          notes: "Retain every lossless field.",
          lineage_key: "Apple|TSMC|manufacturing|Apple silicon",
          source_report_path: "output/evidence/apple-tsmc.json",
          last_verified_at: "2026-06-14T00:00:00.000Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:apple:tsmc:1",
          relation_id: "rel:apple:tsmc:manufacturing:apple-silicon",
          source_type: "press_release",
          title: "Apple newsroom",
          publisher: "Apple",
          source_url: "https://example.com/apple-tsmc",
          source_domain: "example.com",
          published_at: "2025-08-06",
          published_at_resolution: "day",
          retrieved_at: "2026-06-14T00:00:00.000Z",
          excerpt: "TSMC in Arizona is producing chips for Apple.",
          citation_text: "TSMC in Arizona is producing chips for Apple.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v1",
          source_report_path: "output/evidence/apple-tsmc.json",
        },
      ],
    });

    expect(prepared.relations[0]).toMatchObject({
      id: "rel:apple:tsmc:manufacturing:apple-silicon",
      relationshipType: "manufacturing",
      relationshipSubtype: "wafer_foundry",
      productScope: ["Apple silicon", "A-series"],
      evidenceIds: ["evidence:apple:tsmc:1", "evidence:apple:tsmc:2"],
      primaryEvidenceId: "evidence:apple:tsmc:1",
      sourceMethod: "direct_disclosure",
      sourceCount: 2,
      status: "approved",
      summary: "TSMC manufactures Apple silicon.",
      lineageKey: "Apple|TSMC|manufacturing|Apple silicon",
      lastVerifiedAt: "2026-06-14T00:00:00.000Z",
    });
    expect(prepared.relationEdges[0]).toEqual({
      relationId: "rel:apple:tsmc:manufacturing:apple-silicon",
      sourceCompanyId: "company:TSMC",
      targetCompanyId: "company:AAPL",
      snapshotId: "snapshot:2026-06-14.1",
    });
    expect(prepared.evidence[0]).not.toHaveProperty("relationId");
    expect(prepared.evidenceBindings[0]).toEqual({
      relationId: "rel:apple:tsmc:manufacturing:apple-silicon",
      evidenceId: "evidence:apple:tsmc:1",
    });
  });
});
