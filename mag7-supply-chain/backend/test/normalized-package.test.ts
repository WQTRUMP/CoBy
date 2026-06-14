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
      evidenceDate: "2025-08-06",
      evidenceDateResolution: "day",
      evidenceDateNormalized: null,
      evidenceDateIsNormalized: false,
      validFrom: null,
      validFromResolution: null,
      validTo: null,
      validToResolution: null,
      validityNote: null,
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
    expect(prepared.companies.find((company) => company.id === "company:AAPL")).toMatchObject({
      canonicalName: "Apple",
      displayName: "Apple",
      entityProfile: {
        canonicalName: "Apple",
        displayName: "Apple",
      },
    });
  });

  it("maps v3 entity refs and legacy month-normalized inputs without defaulting evidenceDate onto validFrom", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:alphabet:tsmc:manufacturing:tensor",
          snapshot_id: "snapshot:2026-06-14.4",
          company: "Alphabet",
          company_slug: "alphabet",
          supplier: "TSMC",
          supplier_slug: "tsmc",
          company_entity_ref: {
            entity_id: "company:GOOGL",
            display_name: "Google",
            legal_entity_name: "Google LLC",
          },
          supplier_entity_ref: {
            entity_id: "company:TSMC",
            display_name: "TSMC",
            legal_entity_name: "Taiwan Semiconductor Manufacturing Company Limited",
          },
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "manufacturing",
          relationship_subtype: "wafer_foundry",
          product_scope: ["Tensor SoC"],
          evidence_ids: ["evidence:alphabet:tsmc:1"],
          primary_evidence_id: "evidence:alphabet:tsmc:1",
          evidence_date: "2025-03-01",
          evidence_date_resolution: "month-normalized",
          evidence_excerpt: "March quarter commentary supports TSMC foundry usage.",
          source_url: "https://example.com/google-tsmc",
          confidence_label: "strong_evidence",
          confidence_score: 0.9,
          source_method: "manual_research",
          source_count: 2,
          status: "approved",
          summary: "TSMC manufactures Tensor SoCs for Google.",
          notes: "Legacy month-normalized package.",
          lineage_key: "Alphabet|TSMC|manufacturing|Tensor SoC",
          source_report_path: "output/evidence/google-tsmc.json",
          last_verified_at: "2026-06-14T00:00:00.000Z",
          valid_from: "2025-03-01",
          valid_from_resolution: "month-normalized",
          valid_to: null,
          valid_to_resolution: null,
          validity_note: "Management commentary indicates supply in March quarter 2025.",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:alphabet:tsmc:1",
          relation_id: "rel:alphabet:tsmc:manufacturing:tensor",
          source_type: "earnings_call",
          title: "Alphabet Q1 2025 Earnings Call",
          publisher: "Alphabet",
          source_url: "https://example.com/google-tsmc",
          source_domain: "example.com",
          published_at: "2025-04-24",
          published_at_resolution: "day",
          coverage_start: "2025-03-01",
          coverage_end: "2025-03-31",
          coverage_start_resolution: "month",
          coverage_end_resolution: "month",
          retrieved_at: "2026-06-14T00:00:00.000Z",
          excerpt: "March quarter demand drove Tensor wafer demand.",
          citation_text: "March quarter demand drove Tensor wafer demand.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v2",
          source_report_path: "output/evidence/google-tsmc.json",
        },
      ],
    });

    expect(prepared.relations[0]).toMatchObject({
      evidenceDate: "2025-03-01",
      evidenceDateResolution: "month",
      evidenceDateNormalized: "2025-03-01",
      evidenceDateIsNormalized: true,
      validFrom: "2025-03-01",
      validFromResolution: "month",
      validityNote: "Management commentary indicates supply in March quarter 2025.",
    });
    expect(prepared.companies.find((company) => company.id === "company:GOOGL")).toMatchObject({
      canonicalName: "Alphabet",
      displayName: "Google",
      aliases: expect.arrayContaining(["Alphabet", "Google", "Google LLC"]),
      entityProfile: {
        canonicalName: "Alphabet",
        displayName: "Google",
        legalEntities: expect.arrayContaining([
          expect.objectContaining({ name: "Google LLC", aliasType: "legal_entity" }),
        ]),
      },
    });
    expect(prepared.evidence[0]).toMatchObject({
      publishedAtResolution: "day",
      coverageStart: "2025-03-01",
      coverageEnd: "2025-03-31",
      coverageStartResolution: "month",
      coverageEndResolution: "month",
    });
  });

  it("coalesces metadata_date_published into published_at for importer compatibility", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
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
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:meta:lumus:1",
          relation_id: "rel:meta:lumus:component_supply:ray-ban-display-waveguide",
          source_type: "media",
          title: "Meta device supply chain note",
          publisher: "Example",
          source_url: "https://example.com/meta-lumus",
          source_domain: "example.com",
          published_at: "2025-03-15",
          published_at_resolution: "day",
          retrieved_at: "2026-06-14T00:00:00.000Z",
          excerpt: "Lumus components were identified in Meta smart glasses coverage.",
          citation_text: "Lumus components were identified in Meta smart glasses coverage.",
          reliability_tier: 2,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/meta-lumus.json",
        },
      ],
    });

    expect(prepared.relations[0]).toMatchObject({
      evidenceDate: "2025-03-15",
      evidenceDateResolution: "published_at",
      evidenceDateNormalized: null,
      evidenceDateIsNormalized: false,
    });
  });
});
