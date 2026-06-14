import { describe, expect, it } from "vitest";

import {
  companySchema,
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
    expect(parsed.company_entity_ref).toEqual({
      entity_id: "company:tesla",
      display_name: "Tesla",
      legal_entity_name: "Tesla",
    });
    expect(parsed.evidence_date_resolution).toBe("day");
  });

  it("maps legacy month-normalized v2 inputs into canonical v3 date fields", () => {
    const parsed = standardizedImportRelationRecordSchema.parse({
      relation_id: "rel:alphabet:tsmc:manufacturing:tensor",
      snapshot_id: "snapshot:2026-06-14.4",
      company: "Alphabet",
      company_slug: "alphabet",
      supplier: "TSMC",
      supplier_slug: "tsmc",
      tier: 1,
      depth_from_mag7: 1,
      relationship_type: "manufacturing",
      relationship_subtype: "wafer_foundry",
      product_scope: ["Tensor SoC"],
      evidence_ids: ["evidence:alphabet:tsmc:1"],
      primary_evidence_id: "evidence:alphabet:tsmc:1",
      evidence_date: "2025-03-01",
      evidence_date_resolution: "month-normalized",
      evidence_excerpt: "Management commentary indicates supply in March quarter 2025.",
      source_url: "https://example.com/alphabet-tsmc",
      confidence_label: "strong_evidence",
      confidence_score: 0.82,
      source_method: "manual_research",
      source_count: 1,
      status: "approved",
      summary: "TSMC manufactures Google Tensor wafers.",
      lineage_key: "Alphabet|TSMC|manufacturing|Tensor SoC",
      source_report_path: "output/evidence/alphabet-tsmc.json",
      last_verified_at: "2026-06-14T00:00:00.000Z",
      valid_from: "2025-03",
      valid_from_resolution: "month-normalized",
      validity_note: "Month-level anchor derived from a quarter-level commentary.",
    });

    expect(parsed.evidence_date_resolution).toBe("month");
    expect(parsed.evidence_date_normalized).toBe("2025-03-01");
    expect(parsed.evidence_date_is_normalized).toBe(true);
    expect(parsed.valid_from_resolution).toBe("month");
    expect(parsed.company_entity_ref.entity_id).toBe("company:alphabet");
  });

  it("accepts v3 company alias profiles and evidence coverage fields", () => {
    const company = companySchema.parse({
      id: "company:GOOGL",
      ticker: "GOOGL",
      name: "Alphabet",
      canonicalName: "Alphabet",
      displayName: "Google",
      entityType: "Company",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 1,
      aliases: ["Alphabet Inc.", "Google"],
      entityProfile: {
        canonicalName: "Alphabet",
        displayName: "Google",
        legalEntities: [
          {
            id: "alias:company:GOOGL:alphabet-inc",
            name: "Alphabet Inc.",
            normalizedName: "alphabet",
            aliasType: "legal_entity",
            isPrimary: true,
          },
        ],
        brands: [
          {
            id: "alias:company:GOOGL:google-cloud",
            name: "Google Cloud",
            normalizedName: "google cloud",
            aliasType: "brand",
            isPrimary: true,
          },
        ],
        aliases: [
          {
            id: "alias:company:GOOGL:google",
            name: "Google",
            normalizedName: "google",
            aliasType: "short_name",
            isPrimary: true,
          },
        ],
      },
    });

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
      coverage_start: "2025-Q3",
      coverage_end: "2025-Q3",
      coverage_start_resolution: "quarter",
      coverage_end_resolution: "quarter",
      retrieved_at: "2026-06-14T00:00:00.000Z",
      excerpt: "TSMC in Arizona is producing chips for Apple.",
      citation_text: "TSMC in Arizona is producing chips for Apple.",
      reliability_tier: 1,
      parser_version: "manual-normalization-v1",
      source_report_path: "output/evidence/apple-tsmc.json",
    });

    expect(company.displayName).toBe("Google");
    expect(company.entityProfile?.brands[0]?.aliasType).toBe("brand");
    expect(evidence.coverage_start_resolution).toBe("quarter");
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
      coverage_start: "2025-Q3",
      coverage_end: "2025-Q3",
      coverage_start_resolution: "quarter",
      coverage_end_resolution: "quarter",
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
      evidenceDate: "2025-08-06",
      evidenceDateResolution: "day",
      evidence: [
        {
          id: evidence.evidence_id,
          sourceType: evidence.source_type,
          title: evidence.title,
          publisher: evidence.publisher,
          url: evidence.source_url,
          publishedAt: evidence.published_at,
          publishedAtResolution: evidence.published_at_resolution,
          coverageStart: evidence.coverage_start ?? null,
          coverageEnd: evidence.coverage_end ?? null,
          coverageStartResolution: evidence.coverage_start_resolution ?? null,
          coverageEndResolution: evidence.coverage_end_resolution ?? null,
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
              canonicalName: "Apple",
              displayName: "Apple",
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
