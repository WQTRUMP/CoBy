import { describe, expect, it } from "vitest";

import {
  companyListItemSchema,
  companySearchResultItemSchema,
  companySuggestItemSchema,
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

  it("accepts sku_granularity on relation and evidence records while normalizing legacy aliases", () => {
    const relation = standardizedImportRelationRecordSchema.parse({
      relation_id: "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
      snapshot_id: "snapshot:2026-06-15.full.15",
      company: "NVIDIA",
      company_slug: "nvidia",
      supplier: "NVIDIA MMS4A20 800G DR4 single-port OSFP transceiver",
      supplier_slug: "nvidia-mms4a20-800g-dr4-single-port-osfp-transceiver",
      tier: 1,
      depth_from_mag7: 1,
      relationship_type: "component_supply",
      sku_granularity: "target_sku",
      relationship_subtype: "official_optical_transceiver_component_of_quantum_x800",
      product_scope: ["Quantum-X800 QM3x00 switches", "MMS4A20 800G DR4 single-port OSFP transceiver"],
      evidence_ids: ["evidence:nvidia:mms4a20:1"],
      primary_evidence_id: "evidence:nvidia:mms4a20:1",
      evidence_date: "2025-07-23",
      evidence_date_resolution: "day",
      evidence_excerpt: "The NVIDIA MMS4A20 ... is used to link the Quantum-X800 QM3x00 switches.",
      source_url: "https://example.com/nvidia-mms4a20",
      confidence_label: "confirmed",
      confidence_score: 0.95,
      source_method: "direct_disclosure",
      source_count: 1,
      status: "approved",
      summary: "NVIDIA MMS4A20 is a target-SKU component of Quantum-X800 QM3x00.",
      lineage_key: "NVIDIA|MMS4A20|component_supply|Quantum-X800 QM3x00",
      source_report_path: "output/nvidia-sku.md",
      last_verified_at: "2026-06-15T00:41:55Z",
    });

    const evidence = standardizedImportEvidenceRecordSchema.parse({
      evidence_id: "evidence:nvidia:mms4a20:1",
      relation_id: relation.relation_id,
      source_type: "official_doc",
      title: "NVIDIA MMS4A20 800G DR4 Single-Port OSFP Transceiver",
      publisher: "NVIDIA Docs",
      source_url: "https://example.com/nvidia-mms4a20",
      source_domain: "example.com",
      sku_granularity: "target_sku_or_official_component",
      published_at: "2025-07-23",
      published_at_resolution: "day",
      retrieved_at: "2026-06-15T00:41:55Z",
      excerpt: "The NVIDIA MMS4A20 ... is used to link the Quantum-X800 QM3x00 switches.",
      citation_text: "The NVIDIA MMS4A20 ... is used to link the Quantum-X800 QM3x00 switches.",
      reliability_tier: 1,
      parser_version: "manual-normalization-v3",
      source_report_path: "output/nvidia-sku.md",
    });

    expect(relation.sku_granularity).toBe("target_sku");
    expect(evidence.sku_granularity).toBe("platform_component_sku");
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

  it("coalesces metadata_date_published into canonical published_at date resolution", () => {
    const parsed = standardizedImportRelationRecordSchema.parse({
      relation_id: "rel:meta:lumus:component_supply:ray-ban-display-waveguide",
      snapshot_id: "snapshot:2026-06-14.full.7",
      company: "Meta",
      company_slug: "meta",
      supplier: "Lumus",
      supplier_slug: "lumus",
      tier: 1,
      depth_from_mag7: 1,
      relationship_type: "component_supply",
      relationship_subtype: "AR display waveguide",
      product_scope: ["waveguide"],
      evidence_ids: ["evidence:meta:lumus:1"],
      primary_evidence_id: "evidence:meta:lumus:1",
      evidence_date: "2025-03-15",
      evidence_date_resolution: "metadata_date_published",
      evidence_excerpt: "Published metadata timestamp anchors the relation date.",
      source_url: "https://example.com/meta-lumus",
      confidence_label: "strong_evidence",
      confidence_score: 0.8,
      source_method: "metadata_anchor",
      source_count: 1,
      status: "approved",
      summary: "Lumus supplies AR display waveguide components to Meta.",
      lineage_key: "Meta|Lumus|component_supply|waveguide",
      source_report_path: "output/evidence/meta-lumus.json",
      last_verified_at: "2026-06-14T00:00:00.000Z",
    });

    expect(parsed.evidence_date_resolution).toBe("published_at");
    expect(parsed.evidence_date_is_normalized).toBe(false);
    expect(parsed.evidence_date_normalized).toBeNull();
  });

  it("coalesces retrieved_at_only into canonical undated without treating it as published_at", () => {
    const parsed = standardizedImportEvidenceRecordSchema.parse({
      evidence_id: "evidence:tesla:nvidia:1",
      relation_id: "rel:tesla:nvidia:component_supply:autopilot-platform",
      source_type: "official_doc",
      title: "Tesla Additional Resources",
      publisher: "Tesla",
      source_url: "https://example.com/tesla-additional-resources",
      source_domain: "example.com",
      published_at: "2026-06-14",
      published_at_resolution: "retrieved_at_only",
      retrieved_at: "2026-06-14T20:03:15.002Z",
      excerpt: "Autopilot Nvidia kernel.",
      citation_text: "Autopilot Nvidia kernel.",
      reliability_tier: 1,
      parser_version: "manual-normalization-v3",
      source_report_path: "output/evidence/tesla-nvidia.json",
    });

    expect(parsed.published_at_resolution).toBe("undated");
    expect(parsed.published_at_resolution).not.toBe("published_at");
  });

  it("accepts newly promoted supplier and authoritative source types from full.8 evidence packages", () => {
    for (const sourceType of ["supplier_page", "supplier_blog", "authoritative_media"] as const) {
      const parsed = standardizedImportEvidenceRecordSchema.parse({
        evidence_id: `evidence:test:${sourceType}`,
        relation_id: "rel:test",
        source_type: sourceType,
        title: "Test evidence",
        publisher: "Example",
        source_url: "https://example.com/source",
        source_domain: "example.com",
        published_at: "2026-06-14",
        published_at_resolution: "published_at",
        retrieved_at: "2026-06-14T00:00:00.000Z",
        excerpt: "Example excerpt.",
        citation_text: "Example excerpt.",
        reliability_tier: 1,
        parser_version: "manual-normalization-v3",
        source_report_path: "output/evidence/test.json",
      });

      expect(parsed.source_type).toBe(sourceType);
    }
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

  it("preserves display-name semantics across company list, search, and suggest DTOs", () => {
    const entityProfile = {
      canonicalName: "Alphabet",
      displayName: "Google",
      legalEntities: [
        {
          id: "alias:alphabet:google-llc",
          name: "Google LLC",
          normalizedName: "google llc",
          aliasType: "legal_entity" as const,
          isPrimary: true,
        },
      ],
      brands: [
        {
          id: "alias:alphabet:google-cloud",
          name: "Google Cloud",
          normalizedName: "google cloud",
          aliasType: "brand" as const,
          isPrimary: true,
        },
      ],
      aliases: [
        {
          id: "alias:alphabet:google",
          name: "Google",
          normalizedName: "google",
          aliasType: "short_name" as const,
          isPrimary: true,
        },
      ],
    };

    const listItem = companyListItemSchema.parse({
      id: "company:GOOGL",
      ticker: "GOOGL",
      name: "Alphabet",
      canonicalName: "Alphabet",
      displayName: "Google",
      isMag7: true,
      marketCapUsd: 2200000000000,
      entityProfile,
      primaryRegion: "US",
      activeSnapshotId: "snapshot:2026-06-14.3",
    });

    const searchItem = companySearchResultItemSchema.parse({
      ...listItem,
      match: {
        field: "alias",
        value: "Google Cloud",
        aliasType: "brand",
        explanation: 'Matched brand "Google Cloud" for canonical "Alphabet" and display "Google".',
      },
    });

    const suggestItem = companySuggestItemSchema.parse({
      id: "company:GOOGL",
      label: "Google",
      secondaryLabel: "Alphabet",
      ticker: "GOOGL",
      isMag7: true,
      canonicalName: "Alphabet",
      displayName: "Google",
      entityProfile,
      match: {
        field: "alias",
        value: "Google LLC",
        aliasType: "legal_entity",
        explanation: 'Matched legal entity "Google LLC" for canonical "Alphabet" and display "Google".',
      },
    });

    expect(listItem.displayName).toBe("Google");
    expect(listItem.entityProfile?.canonicalName).toBe("Alphabet");
    expect(searchItem.match?.aliasType).toBe("brand");
    expect(suggestItem.match?.explanation).toContain('display "Google"');
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
