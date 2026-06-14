import { describe, expect, it } from "vitest";

import {
  relationSchema,
  standardizedImportEvidenceRecordSchema,
  standardizedImportRelationRecordSchema,
  subgraphSchema,
} from "../src/index.ts";

describe("@mag7/contracts", () => {
  it("keeps normalized relation records lossless and accepts new relationship types", () => {
    const parsed = standardizedImportRelationRecordSchema.parse({
      relation_id: "rel:idra:tesla:equipment:mega-giga-press",
      snapshot_id: "snapshot:2026-06-14.2",
      company: "Tesla",
      company_slug: "tesla",
      supplier: "IDRA Group",
      supplier_slug: "idra-group",
      tier: 1,
      depth_from_mag7: 1,
      relationship_type: "heavy_industry_equipment",
      relationship_subtype: "giga_press",
      product_scope: ["9000T giga press", "megacasting line"],
      evidence_ids: ["evidence:idra:tesla:1", "evidence:idra:tesla:2"],
      primary_evidence_id: "evidence:idra:tesla:1",
      evidence_date: "2026-06-10",
      evidence_date_resolution: "day",
      evidence_excerpt: "IDRA supplied large die-casting systems to Tesla.",
      source_url: "https://example.com/idra-tesla",
      confidence_label: "strong_evidence",
      confidence_score: 0.83,
      source_method: "multi_source_research",
      source_count: 2,
      status: "approved",
      summary: "IDRA supplies Tesla megacasting equipment.",
      lineage_key: "Tesla|IDRA Group|heavy_industry_equipment|megacasting",
      source_report_path: "output/evidence/idra-tesla.json",
      last_verified_at: "2026-06-14T00:00:00.000Z",
    });

    expect(parsed.relationship_type).toBe("heavy_industry_equipment");
    expect(parsed.product_scope).toEqual(["9000T giga press", "megacasting line"]);
    expect(parsed.evidence_ids).toEqual(["evidence:idra:tesla:1", "evidence:idra:tesla:2"]);
  });

  it("preserves relation evidence bindings in canonical DTOs", () => {
    const evidence = standardizedImportEvidenceRecordSchema.parse({
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
    });

    const relation = relationSchema.parse({
      id: "rel:apple:tsmc:manufacturing:apple-silicon",
      sourceId: "company:TSMC",
      targetId: "company:AAPL",
      relationshipType: "manufacturing",
      relationshipSubtype: "wafer_foundry",
      tier: 1,
      depthFromMag7: 1,
      confidence: "confirmed",
      confidenceScore: 0.96,
      summary: "TSMC manufactures Apple silicon.",
      productScope: ["Apple silicon"],
      evidenceIds: [evidence.evidence_id],
      primaryEvidenceId: evidence.evidence_id,
      evidenceCount: 1,
      snapshotId: "snapshot:2026-06-14.1",
      status: "approved",
      sourceMethod: "direct_disclosure",
      sourceCount: 1,
      lineageKey: "Apple|TSMC|manufacturing|Apple silicon",
      lastVerifiedAt: "2026-06-14T00:00:00.000Z",
      evidence: [
        {
          id: evidence.evidence_id,
          sourceType: evidence.source_type,
          title: evidence.title,
          publisher: evidence.publisher,
          url: evidence.source_url,
          publishedAt: evidence.published_at,
          retrievedAt: evidence.retrieved_at,
          excerpt: evidence.excerpt,
          language: "en",
          hash: evidence.evidence_id,
          sourceDomain: evidence.source_domain,
          citationText: evidence.citation_text,
          reliabilityTier: evidence.reliability_tier,
          parserVersion: evidence.parser_version,
        },
      ],
    });

    expect(() =>
      subgraphSchema.parse({
        snapshot: {
          id: "snapshot:2026-06-14.1",
          version: "2026.06.14-01",
          status: "published",
          publishedAt: "2026-06-14T00:00:00.000Z",
          scope: ["company:AAPL"],
        },
        nodes: [
          {
            id: "company:AAPL",
            entityType: "Company",
            label: "Apple",
            company: {
              id: "company:AAPL",
              ticker: "AAPL",
              name: "Apple",
              entityType: "Company",
              companyType: "public_company",
              country: "US",
              isMag7: true,
              marketCapUsd: 1,
              aliases: [],
              active: true,
              primaryRegion: "US",
              activeSnapshotId: "snapshot:2026-06-14.1",
            },
          },
        ],
        relations: [relation],
      }),
    ).not.toThrow();
  });
});
