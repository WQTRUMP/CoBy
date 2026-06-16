import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadNormalizedImportPackage, prepareNormalizedImport } from "../src/lib/normalized-package.js";

describe("prepareNormalizedImport", () => {
  it("preserves lossless normalized fields while splitting relation and evidence bindings into graph edges", () => {
    const prepared = prepareNormalizedImport({
      skuGranularityByRelationId: {
        "rel:apple:tsmc:manufacturing:apple-silicon": "family_only",
      },
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
      skuGranularity: "family_only",
      evidenceDate: "2025-08-06",
      evidenceDateResolution: "day",
      evidenceDateNormalized: null,
      evidenceDateIsNormalized: false,
      validFrom: null,
      validFromResolution: null,
      validTo: null,
      validToResolution: null,
      validityNote: null,
      skuGranularityDetailValue: "family_only",
      skuGranularitySource: "authoritative_manifest",
      skuGranularityRaw: null,
      skuGranularityIsBackfilled: true,
    });
    expect(prepared.relationEdges[0]).toEqual({
      relationId: "rel:apple:tsmc:manufacturing:apple-silicon",
      sourceCompanyId: "company:TSMC",
      targetCompanyId: "company:AAPL",
      snapshotId: "snapshot:2026-06-14.1",
    });
    expect(prepared.evidence[0]).not.toHaveProperty("relationId");
    expect(prepared.evidence[0]).toMatchObject({
      skuGranularity: "family_only",
      skuGranularityDetailValue: "family_only",
      skuGranularitySource: "relation_inherited_for_evidence",
      skuGranularityRaw: null,
      skuGranularityIsBackfilled: true,
    });
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

  it("hydrates sku granularity from package metadata and evidence notes without changing record counts", () => {
    const prepared = prepareNormalizedImport({
      skuGranularityByRelationId: {
        "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver": "target_sku",
      },
      relations: [
        {
          relation_id: "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
          snapshot_id: "snapshot:2026-06-15.full.15",
          company: "NVIDIA",
          company_slug: "nvidia",
          supplier: "NVIDIA MMS4A20 800G DR4 single-port OSFP transceiver",
          supplier_slug: "nvidia-mms4a20-800g-dr4-single-port-osfp-transceiver",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "component_supply",
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
          summary: "NVIDIA MMS4A20 is part of Quantum-X800 QM3x00.",
          lineage_key: "NVIDIA|MMS4A20|component_supply|Quantum-X800 QM3x00",
          source_report_path: "output/nvidia-sku.md",
          last_verified_at: "2026-06-15T00:41:55Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:nvidia:mms4a20:1",
          relation_id: "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
          source_type: "official_doc",
          title: "NVIDIA MMS4A20 800G DR4 Single-Port OSFP Transceiver",
          publisher: "NVIDIA Docs",
          source_url: "https://example.com/nvidia-mms4a20",
          source_domain: "example.com",
          published_at: "2025-07-23",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T00:41:55Z",
          excerpt: "The NVIDIA MMS4A20 ... is used to link the Quantum-X800 QM3x00 switches.",
          citation_text: "The NVIDIA MMS4A20 ... is used to link the Quantum-X800 QM3x00 switches.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/nvidia-sku.md",
          notes: "source_row_id=r10-05; sku_granularity=target_sku_or_official_component; formalizable=true",
        },
      ],
    });

    expect(prepared.relations).toHaveLength(1);
    expect(prepared.evidence).toHaveLength(1);
    expect(prepared.relations[0]?.skuGranularity).toBe("target_sku");
    expect(prepared.evidence[0]?.skuGranularity).toBe("target_sku");
    expect(prepared.relations[0]).toMatchObject({
      skuGranularityDetailValue: "target_sku",
      skuGranularitySource: "authoritative_manifest",
      skuGranularityNote: "Backfilled from full.15 authoritative manifest mapping.",
      skuGranularityIsBackfilled: true,
    });
    expect(prepared.evidence[0]).toMatchObject({
      skuGranularityDetailValue: "target_sku",
      skuGranularitySource: "relation_inherited_for_evidence",
      skuGranularityRaw: "target_sku_or_official_component",
      skuGranularityIsBackfilled: true,
    });
  });

  it("preserves legacy-only evidence notes as documented compatibility detail without promoting the scalar value", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:amazon:legacy:component_supply:unknown-board",
          snapshot_id: "snapshot:2026-06-15.full.15",
          company: "Amazon",
          company_slug: "amazon",
          supplier: "Legacy Board Vendor",
          supplier_slug: "legacy-board-vendor",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "component_supply",
          relationship_subtype: "legacy_board",
          product_scope: ["Unknown board"],
          evidence_ids: ["evidence:amazon:legacy:1"],
          primary_evidence_id: "evidence:amazon:legacy:1",
          evidence_date: "2025-01-01",
          evidence_date_resolution: "day",
          evidence_excerpt: "Legacy analyst note mentions a target SKU alias.",
          source_url: "https://example.com/amazon-legacy-board",
          confidence_label: "strong_evidence",
          confidence_score: 0.75,
          source_method: "manual_research",
          source_count: 1,
          status: "approved",
          summary: "Legacy board vendor mention for Amazon hardware.",
          lineage_key: "Amazon|Legacy Board Vendor|component_supply|Unknown board",
          source_report_path: "output/amazon-legacy-board.md",
          last_verified_at: "2026-06-15T00:41:55Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:amazon:legacy:1",
          relation_id: "rel:amazon:legacy:component_supply:unknown-board",
          source_type: "media",
          title: "Legacy board vendor note",
          publisher: "Example Media",
          source_url: "https://example.com/amazon-legacy-board",
          source_domain: "example.com",
          published_at: "2025-01-01",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T00:41:55Z",
          excerpt: "Legacy analyst note mentions a target SKU alias.",
          citation_text: "Legacy analyst note mentions a target SKU alias.",
          reliability_tier: 2,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/amazon-legacy-board.md",
          notes: "sku_granularity=target_sku_or_official_component; analyst_note=legacy_only",
        },
      ],
    });

    expect(prepared.evidence[0]).toMatchObject({
      skuGranularity: "platform_component_sku",
      skuGranularityDetailValue: "documented_legacy_only",
      skuGranularitySource: "legacy_note_backfill",
      skuGranularityRaw: "target_sku_or_official_component",
      skuGranularityNote:
        "Legacy note preserved for compatibility only; not promoted to an authoritative SKU granularity fact.",
      skuGranularityIsBackfilled: true,
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

  it("coalesces retrieved_at_only into undated for evidence importer compatibility", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:tesla:nvidia:component_supply:autopilot-platform",
          snapshot_id: "snapshot:2026-06-14.full.8",
          company: "Tesla",
          company_slug: "tesla",
          supplier: "NVIDIA",
          supplier_slug: "nvidia",
          tier: 2,
          depth_from_mag7: 2,
          relationship_type: "component_supply",
          relationship_subtype: "supports_autopilot_compute_platform",
          product_scope: ["Tesla HW2 / HW2.5 Autopilot platform"],
          evidence_ids: ["evidence:tesla:nvidia:1"],
          primary_evidence_id: "evidence:tesla:nvidia:1",
          evidence_date: "2026-06-14",
          evidence_date_resolution: "retrieved_at_only",
          evidence_excerpt: "Autopilot Nvidia kernel.",
          source_url: "https://example.com/tesla-additional-resources",
          confidence_label: "strong_evidence",
          confidence_score: 0.84,
          source_method: "direct_disclosure",
          source_count: 1,
          status: "approved",
          summary: "Tesla discloses Nvidia kernel usage for early Autopilot compute.",
          lineage_key: "Tesla|NVIDIA|supports_autopilot_compute_platform|HW2",
          source_report_path: "output/evidence/tesla-nvidia.json",
          last_verified_at: "2026-06-14T20:03:15.002Z",
        },
      ],
      evidence: [
        {
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
        },
      ],
    });

    expect(prepared.evidence[0]).toMatchObject({
      publishedAt: "2026-06-14",
      publishedAtResolution: "undated",
      retrievedAt: "2026-06-14T20:03:15.002Z",
    });
    expect(prepared.evidence[0].publishedAtResolution).not.toBe("published_at");
  });

  it("coalesces legacy retrieved_at_surrogate into the same undated boundary without treating it as published_at", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:tesla:nvidia:component_supply:autopilot-platform-legacy",
          snapshot_id: "snapshot:2026-06-14.full.8",
          company: "Tesla",
          company_slug: "tesla",
          supplier: "NVIDIA",
          supplier_slug: "nvidia",
          tier: 2,
          depth_from_mag7: 2,
          relationship_type: "component_supply",
          relationship_subtype: "supports_autopilot_compute_platform",
          product_scope: ["Tesla HW2 / HW2.5 Autopilot platform"],
          evidence_ids: ["evidence:tesla:nvidia:legacy"],
          primary_evidence_id: "evidence:tesla:nvidia:legacy",
          evidence_date: "2026-06-14",
          evidence_date_resolution: "retrieved_at_surrogate" as never,
          evidence_excerpt: "Autopilot Nvidia kernel.",
          source_url: "https://example.com/tesla-additional-resources",
          confidence_label: "strong_evidence",
          confidence_score: 0.84,
          source_method: "direct_disclosure",
          source_count: 1,
          status: "approved",
          summary: "Tesla discloses Nvidia kernel usage for early Autopilot compute.",
          lineage_key: "Tesla|NVIDIA|supports_autopilot_compute_platform|HW2-legacy",
          source_report_path: "output/evidence/tesla-nvidia.json",
          last_verified_at: "2026-06-14T20:03:15.002Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:tesla:nvidia:legacy",
          relation_id: "rel:tesla:nvidia:component_supply:autopilot-platform-legacy",
          source_type: "official_doc",
          title: "Tesla Additional Resources",
          publisher: "Tesla",
          source_url: "https://example.com/tesla-additional-resources",
          source_domain: "example.com",
          published_at: "2026-06-14",
          published_at_resolution: "retrieved_at_surrogate" as never,
          retrieved_at: "2026-06-14T20:03:15.002Z",
          excerpt: "Autopilot Nvidia kernel.",
          citation_text: "Autopilot Nvidia kernel.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/tesla-nvidia.json",
        },
      ],
    });

    expect(prepared.relations[0]).toMatchObject({
      evidenceDate: "2026-06-14",
      evidenceDateResolution: "undated",
    });
    expect(prepared.relations[0].evidenceDateResolution).not.toBe("published_at");

    expect(prepared.evidence[0]).toMatchObject({
      publishedAt: "2026-06-14",
      publishedAtResolution: "undated",
      retrievedAt: "2026-06-14T20:03:15.002Z",
    });
    expect(prepared.evidence[0].publishedAtResolution).not.toBe("published_at");
  });

  it("accepts expanded official source_type variants when preparing normalized imports", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:apple:corning:component_supply:cover-glass",
          snapshot_id: "snapshot:2026-06-15.full.16",
          company: "Apple",
          company_slug: "apple",
          supplier: "Corning",
          supplier_slug: "corning",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "component_supply",
          relationship_subtype: "cover_glass",
          product_scope: ["iPhone cover glass"],
          evidence_ids: ["evidence:apple:corning:official-pr"],
          primary_evidence_id: "evidence:apple:corning:official-pr",
          evidence_date: "2026-06-15",
          evidence_date_resolution: "day",
          evidence_excerpt: "Corning announced a long-term supply collaboration with Apple.",
          source_url: "https://example.com/apple-corning-official-pr",
          confidence_label: "strong_evidence",
          confidence_score: 0.89,
          source_method: "direct_disclosure",
          source_count: 1,
          status: "approved",
          summary: "Corning supplies cover glass to Apple.",
          lineage_key: "Apple|Corning|component_supply|cover_glass",
          source_report_path: "output/evidence/apple-corning.json",
          last_verified_at: "2026-06-15T03:30:00.000Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:apple:corning:official-pr",
          relation_id: "rel:apple:corning:component_supply:cover-glass",
          source_type: "official_press_release",
          title: "Apple and Corning expand US manufacturing commitment",
          publisher: "Apple",
          source_url: "https://example.com/apple-corning-official-pr",
          source_domain: "example.com",
          published_at: "2026-06-15",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T03:30:00.000Z",
          excerpt: "Apple announced a multi-year commitment supporting Corning's advanced glass production.",
          citation_text: "Apple announced a multi-year commitment supporting Corning's advanced glass production.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/apple-corning.json",
        },
      ],
    });

    expect(prepared.evidence[0]).toMatchObject({
      id: "evidence:apple:corning:official-pr",
      sourceType: "official_press_release",
      title: "Apple and Corning expand US manufacturing commitment",
    });
  });

  it("accepts official_product_page evidence from the latest full package during normalized import preparation", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:amazon:trn2-ultraserver:component_supply:efav3-scale-out-networking",
          snapshot_id: "snapshot:2026-06-15.full.17",
          company: "Amazon",
          company_slug: "amazon",
          supplier: "Trn2 UltraServer",
          supplier_slug: "trn2-ultraserver",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "component_supply",
          relationship_subtype: "efav3_scale_out_networking",
          product_scope: ["Amazon EC2 Trn2 instances"],
          evidence_ids: ["evidence:amazon:efav3:2026-06-15:amazon-ec2-trn2-instances:1"],
          primary_evidence_id: "evidence:amazon:efav3:2026-06-15:amazon-ec2-trn2-instances:1",
          evidence_date: "2026-06-15",
          evidence_date_resolution: "day",
          evidence_excerpt: "Trn2 UltraServers deliver 12.8 Tbps of EFAv3 networking.",
          source_url: "https://aws.amazon.com/ec2/instance-types/trn2/",
          confidence_label: "confirmed",
          confidence_score: 0.95,
          source_method: "direct_disclosure",
          source_count: 1,
          status: "approved",
          summary: "AWS documents EFAv3 networking on the Trn2 product page.",
          lineage_key: "Amazon|Trn2 UltraServer|component_supply|efav3_scale_out_networking",
          source_report_path: "output/evidence/amazon-trn2.json",
          last_verified_at: "2026-06-15T06:45:00Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:amazon:efav3:2026-06-15:amazon-ec2-trn2-instances:1",
          relation_id: "rel:amazon:trn2-ultraserver:component_supply:efav3-scale-out-networking",
          source_type: "official_product_page",
          title: "Amazon EC2 Trn2 instances",
          publisher: "AWS",
          source_url: "https://aws.amazon.com/ec2/instance-types/trn2/",
          source_domain: "aws.amazon.com",
          published_at: "2026-06-15",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T06:45:00Z",
          excerpt: "Trn2 UltraServers deliver 12.8 Tbps of EFAv3 networking.",
          citation_text: "Trn2 UltraServers deliver 12.8 Tbps of EFAv3 networking.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/amazon-trn2.json",
        },
      ],
    });

    expect(prepared.evidence[0]).toMatchObject({
      id: "evidence:amazon:efav3:2026-06-15:amazon-ec2-trn2-instances:1",
      sourceType: "official_product_page",
      title: "Amazon EC2 Trn2 instances",
      sourceDomain: "aws.amazon.com",
    });
  });

  it("normalizes round19-compatible evidence source_type aliases during direct load", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:apple:ningbo-shanshan:materials_supply:compat-esg-report",
          snapshot_id: "snapshot:2026-06-15.full.19-candidate",
          company: "Apple",
          company_slug: "apple",
          supplier: "Ningbo Shanshan",
          supplier_slug: "ningbo-shanshan",
          tier: 1,
          depth_from_mag7: 1,
          relationship_type: "materials_supply",
          relationship_subtype: "compat_esg_report",
          product_scope: ["Battery materials"],
          evidence_ids: ["evidence:apple:ningbo-shanshan:compat-esg-report:1"],
          primary_evidence_id: "evidence:apple:ningbo-shanshan:compat-esg-report:1",
          evidence_date: "2025-04-27",
          evidence_date_resolution: "day",
          evidence_excerpt: "Compatibility row for official ESG report alias handling.",
          source_url: "https://example.com/ningbo-shanshan-esg",
          confidence_label: "strong_evidence",
          confidence_score: 0.86,
          source_method: "manual_research",
          source_count: 1,
          status: "approved",
          summary: "Importer compatibility for official ESG report aliases.",
          lineage_key: "Apple|Ningbo Shanshan|materials_supply|compat_esg_report",
          source_report_path: "output/evidence/apple-ningbo-shanshan.md",
          last_verified_at: "2026-06-15T23:59:00Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:apple:ningbo-shanshan:compat-esg-report:1",
          relation_id: "rel:apple:ningbo-shanshan:materials_supply:compat-esg-report",
          source_type: "official_esg_report" as never,
          title: "Ningbo Shanshan ESG report",
          publisher: "Ningbo Shanshan",
          source_url: "https://example.com/ningbo-shanshan-esg",
          source_domain: "example.com",
          published_at: "2025-04-27",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T23:59:00Z",
          excerpt: "Compatibility row for official ESG report alias handling.",
          citation_text: "Compatibility row for official ESG report alias handling.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/apple-ningbo-shanshan.md",
        },
      ],
    });

    expect(prepared.evidence[0]).toMatchObject({
      sourceType: "official_report",
      title: "Ningbo Shanshan ESG report",
    });
  });

  it("normalizes sec_filing and mixed anchor source types during direct load", () => {
    const prepared = prepareNormalizedImport({
      relations: [
        {
          relation_id: "rel:amazon:astera-labs:component_supply:compat-sec-filing",
          snapshot_id: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
          company: "Amazon",
          company_slug: "amazon",
          supplier: "Astera Labs",
          supplier_slug: "astera-labs",
          tier: 3,
          depth_from_mag7: 3,
          relationship_type: "component_supply",
          relationship_subtype: "compat_sec_filing",
          product_scope: ["Amazon parent procurement"],
          evidence_ids: [
            "evidence:amazon:astera-labs:compat-sec-filing:1",
            "evidence:amazon:astera-labs:compat-anchor:1",
          ],
          primary_evidence_id: "evidence:amazon:astera-labs:compat-sec-filing:1",
          evidence_date: "2026-02-05",
          evidence_date_resolution: "day",
          evidence_excerpt: "Compatibility rows for full.21 source type aliases.",
          source_url: "https://example.com/amazon-astera-labs",
          confidence_label: "strong_evidence",
          confidence_score: 0.79,
          source_method: "cross_reported",
          source_count: 2,
          status: "approved",
          summary: "Compatibility rows for sec_filing and mixed anchor aliases.",
          lineage_key: "Amazon|Astera Labs|component_supply|compat_sec_filing",
          source_report_path: "output/evidence/amazon-astera-labs.json",
          last_verified_at: "2026-06-15T18:00:00Z",
        },
      ],
      evidence: [
        {
          evidence_id: "evidence:amazon:astera-labs:compat-sec-filing:1",
          relation_id: "rel:amazon:astera-labs:component_supply:compat-sec-filing",
          source_type: "sec_filing" as never,
          title: "Astera Labs 8-K",
          publisher: "SEC",
          source_url: "https://example.com/amazon-astera-labs-8k",
          source_domain: "sec.gov",
          published_at: "2026-02-05",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T18:00:00Z",
          excerpt: "Amazon procurement framework disclosed in 8-K.",
          citation_text: "Amazon procurement framework disclosed in 8-K.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/amazon-astera-labs.json",
        },
        {
          evidence_id: "evidence:amazon:astera-labs:compat-anchor:1",
          relation_id: "rel:amazon:astera-labs:component_supply:compat-sec-filing",
          source_type: "industry_media_plus_official_anchor" as never,
          title: "Mixed media and official anchor note",
          publisher: "Example Media",
          source_url: "https://example.com/amazon-astera-labs-anchor",
          source_domain: "example.com",
          published_at: "2026-02-06",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T18:00:00Z",
          excerpt: "Cross-reported media row with an official anchor.",
          citation_text: "Cross-reported media row with an official anchor.",
          reliability_tier: 2,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/amazon-astera-labs.json",
        },
      ],
    });

    expect(prepared.evidence.map((item) => item.sourceType)).toEqual([
      "official_filing",
      "authoritative_media",
    ]);
  });

  it("remaps candidate-only all-candidates rows into a draft candidate shell snapshot while preserving authoritative metadata", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "full22-top-level-tail-"));

    try {
      const relationsPath = join(tempDir, "relations-all-candidates.jsonl");
      const evidencePath = join(tempDir, "evidence-all-candidates.jsonl");
      const manifestPath = join(tempDir, "mag7-full-package-manifest.json");

      await writeFile(
        manifestPath,
        JSON.stringify({
          package_snapshot_id: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
          authoritative_snapshot: "snapshot:2026-06-15.full.18",
          formal_boundary_reconciliation: {
            resolved_counts: {
              candidate_only_delta: {
                relations: 1,
                evidence: 1,
              },
            },
          },
        }),
        "utf8",
      );
      await writeFile(
        relationsPath,
        `${JSON.stringify({
          schema_version: "mag7-supply-chain.import-relations.v3",
          relation_id: "rel:amazon:astera-labs:component_supply:candidate-shell",
          snapshot_id: "snapshot:2026-06-15.full.18",
          company: "Amazon",
          company_slug: "amazon",
          supplier: "Astera Labs",
          supplier_slug: "astera-labs",
          tier: 3,
          depth_from_mag7: 3,
          relationship_type: "component_supply",
          relationship_subtype: "candidate_shell",
          product_scope: ["Amazon parent procurement"],
          evidence_ids: ["evidence:amazon:astera-labs:candidate-shell:1"],
          primary_evidence_id: "evidence:amazon:astera-labs:candidate-shell:1",
          evidence_date: "2026-02-05",
          evidence_date_resolution: "day",
          evidence_excerpt: "Candidate shell compatibility row.",
          source_url: "https://example.com/amazon-astera-labs-8k",
          confidence_label: "strong_evidence",
          confidence_score: 0.79,
          source_method: "cross_reported",
          source_count: 1,
          status: "candidate_only",
          summary: "Candidate shell compatibility row.",
          notes: "decision=candidate_only",
          lineage_key: "Amazon|Astera Labs|component_supply|candidate_shell",
          source_report_path: "output/evidence/amazon-astera-labs.json",
          last_verified_at: "2026-06-15T18:00:00Z",
        })}\n`,
        "utf8",
      );
      await writeFile(
        evidencePath,
        `${JSON.stringify({
          evidence_id: "evidence:amazon:astera-labs:candidate-shell:1",
          relation_id: "rel:amazon:astera-labs:component_supply:candidate-shell",
          source_type: "sec_filing",
          title: "Astera Labs 8-K",
          publisher: "SEC",
          source_url: "https://example.com/amazon-astera-labs-8k",
          source_domain: "sec.gov",
          published_at: "2026-02-05",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T18:00:00Z",
          excerpt: "Candidate shell compatibility row.",
          citation_text: "Candidate shell compatibility row.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/amazon-astera-labs.json",
        })}\n`,
        "utf8",
      );

      const pkg = await loadNormalizedImportPackage(relationsPath, evidencePath, manifestPath);
      const prepared = prepareNormalizedImport(pkg);

      expect(pkg.boundaryMetadata).toEqual({
        packageSnapshotId: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
        authoritativeSnapshotId: "snapshot:2026-06-15.full.18",
        candidateOnlyRelationCount: 1,
        candidateOnlyEvidenceCount: 1,
      });
      expect(pkg.relations[0]).toMatchObject({
        snapshot_id: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
        status: "draft",
      });
      expect(pkg.evidence[0]).toMatchObject({
        source_type: "official_filing",
      });
      expect(prepared.relations[0]).toMatchObject({
        snapshotId: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
        status: "draft",
      });
      expect(prepared.snapshots).toEqual([
        expect.objectContaining({
          id: "snapshot:2026-06-16.full.22-amazon-tail-candidate",
          status: "draft",
          notes: expect.stringContaining("authoritative published snapshot remains snapshot:2026-06-15.full.18"),
        }),
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("coerces full.19 mixed-schema published rows into canonical tier and entity refs during direct load", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "full19-direct-load-"));

    try {
      const relationsPath = join(tempDir, "relations.jsonl");
      const evidencePath = join(tempDir, "evidence.jsonl");

      await writeFile(
        relationsPath,
        `${JSON.stringify({
          schema_version: "mag7-supply-chain.import-relations.v3",
          relation_id: "rel:microsoft:amd-instinct-mi300x-rocm:cloud_service:compat-direct-load",
          snapshot_id: "snapshot:2026-06-15.full.19-candidate",
          company: "Microsoft",
          company_slug: "microsoft",
          company_entity_id: "company:microsoft",
          company_canonical_name: "Microsoft",
          company_display_name: "Microsoft Azure",
          company_legal_entity_name: "Microsoft Corporation",
          supplier: "AMD Instinct MI300X / ROCm",
          supplier_slug: "amd-instinct-mi300x-rocm",
          supplier_entity_id: "entity:amd-instinct-mi300x-rocm",
          supplier_display_name: "AMD Instinct MI300X / ROCm",
          tier: "2",
          depth_from_mag7: 2,
          relationship_type: "cloud_service",
          relationship_subtype: "compat_direct_load",
          product_scope: ["Azure OpenAI Service"],
          evidence_ids: ["evidence:microsoft:amd-instinct-mi300x-rocm:compat-direct-load:1"],
          primary_evidence_id: "evidence:microsoft:amd-instinct-mi300x-rocm:compat-direct-load:1",
          evidence_date: "2024-05-21",
          evidence_date_resolution: "day",
          evidence_excerpt: "Compatibility row mirrors the full.19 mixed-schema direct-load shape.",
          source_url: "https://example.com/microsoft-azure-mi300x",
          confidence_label: "strong_evidence",
          confidence_score: 0.88,
          source_method: "cross_reported",
          source_count: 1,
          status: "approved",
          summary: "Compatibility row for direct-load coercion.",
          lineage_key: "Microsoft|AMD Instinct MI300X / ROCm|cloud_service|compat_direct_load",
          source_report_path: "output/evidence/microsoft-azure-mi300x.md",
          last_verified_at: "2026-06-15T18:00:00Z",
        })}\n`,
        "utf8",
      );
      await writeFile(
        evidencePath,
        `${JSON.stringify({
          evidence_id: "evidence:microsoft:amd-instinct-mi300x-rocm:compat-direct-load:1",
          relation_id: "rel:microsoft:amd-instinct-mi300x-rocm:cloud_service:compat-direct-load",
          source_type: "official_doc",
          title: "Azure OpenAI compatibility note",
          publisher: "Microsoft",
          source_url: "https://example.com/microsoft-azure-mi300x",
          source_domain: "example.com",
          published_at: "2024-05-21",
          published_at_resolution: "day",
          retrieved_at: "2026-06-15T18:00:00Z",
          excerpt: "Compatibility row mirrors the full.19 mixed-schema direct-load shape.",
          citation_text: "Compatibility row mirrors the full.19 mixed-schema direct-load shape.",
          reliability_tier: 1,
          parser_version: "manual-normalization-v3",
          source_report_path: "output/evidence/microsoft-azure-mi300x.md",
        })}\n`,
        "utf8",
      );

      const pkg = await loadNormalizedImportPackage(relationsPath, evidencePath);

      expect(pkg.relations[0]).toMatchObject({
        relation_id: "rel:microsoft:amd-instinct-mi300x-rocm:cloud_service:compat-direct-load",
        tier: 2,
        company_entity_ref: {
          entity_id: "company:microsoft",
          display_name: "Microsoft Azure",
          legal_entity_name: "Microsoft Corporation",
        },
        supplier_entity_ref: {
          entity_id: "entity:amd-instinct-mi300x-rocm",
          display_name: "AMD Instinct MI300X / ROCm",
          legal_entity_name: "AMD Instinct MI300X / ROCm",
        },
      });

      const prepared = prepareNormalizedImport(pkg);
      expect(prepared.relationEdges[0]).toMatchObject({
        relationId: "rel:microsoft:amd-instinct-mi300x-rocm:cloud_service:compat-direct-load",
        sourceCompanyId: "company:amd-instinct-mi300x-rocm",
        targetCompanyId: "company:MSFT",
        snapshotId: "snapshot:2026-06-15.full.19-candidate",
      });
      expect(prepared.companies.find((company) => company.id === "company:MSFT")).toMatchObject({
        canonicalName: "Microsoft",
        displayName: "Microsoft Azure",
        entityProfile: {
          canonicalName: "Microsoft",
          displayName: "Microsoft Azure",
          legalEntities: expect.arrayContaining([
            expect.objectContaining({ name: "Microsoft Corporation", aliasType: "legal_entity" }),
          ]),
        },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
