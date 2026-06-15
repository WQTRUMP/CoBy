import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CompanySidebar } from "../.tmp-contract-tests/src/components/CompanySidebar.js";
import { EvidencePanel } from "../.tmp-contract-tests/src/components/EvidencePanel.js";
import { GraphCanvas } from "../.tmp-contract-tests/src/components/GraphCanvas.js";
import { RelationsPanel } from "../.tmp-contract-tests/src/components/RelationsPanel.js";
import { TopBar } from "../.tmp-contract-tests/src/components/TopBar.js";
import { adaptCompanyOptions, adaptGraphViewModel } from "../.tmp-contract-tests/src/adapters/graphExplorerAdapter.js";
import {
  getCompaniesResponse,
  getCompanyOverviewResponse,
  getCompanyResponse,
  getSubgraphResponse,
} from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

test("renders relationship filters with real type and subtype options", () => {
  const companies = adaptCompanyOptions({
    ...getCompaniesResponse(),
    items: getCompaniesResponse().items.map((company) => ({
      ...company,
      match:
        company.id === "company:TSLA"
          ? {
              field: "alias",
              value: "Tesla Manufacturing LLC",
              aliasType: "legal_entity",
              explanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla" and display "Tesla".',
            }
          : undefined,
    })),
    query: "tesla manufacturing llc",
  });
  const graph = adaptGraphViewModel({
    company: getCompanyResponse("company:TSLA"),
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    focusCompanyOption: {
      id: "company:TSLA",
      ticker: "TSLA",
      name: "Tesla",
      displayName: "Tesla",
      canonicalName: "Tesla",
      shortName: "Tesla",
      focus: "Tesla",
      searchMatch: {
        field: "alias",
        value: "Tesla Manufacturing LLC",
        aliasType: "legal_entity",
        explanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla" and display "Tesla".',
      },
      aliasHitExplanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla" and display "Tesla".',
      hierarchySummary: "Group: Tesla",
      primaryRegion: "North America",
      marketCapUsd: 1000,
      isMag7: true,
      entityProfile: getCompanyResponse("company:TSLA").item.entityProfile,
    },
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
    },
  });

  const markup = renderToStaticMarkup(
    React.createElement(TopBar, {
      companies,
      depth: 2,
      filtersOpen: true,
      graph,
      onCompanySelect() {},
      onDepthChange() {},
      onFiltersClear() {},
      onFiltersToggle() {},
      onRelationshipSubtypeChange() {},
      onRelationshipTypeToggle() {},
      onSearchChange() {},
      relationshipSubtype: "battery_cells",
      relationshipSubtypeOptions: graph.relationshipSubtypeOptions,
      relationshipTypes: ["component_supply"],
      relationTypeOptions: graph.relationTypeOptions,
      search: "",
      selectedCompanyId: graph.focusCompany.id,
    }),
  );

  assert.match(markup, /Filters · 2/);
  assert.match(markup, /Relationship types/);
  assert.match(markup, /Component Supply/);
  assert.match(markup, /Battery Cells \(1\)/);
  assert.match(markup, /canonical groups, brands, legal entities, and facility aliases separately/i);
  assert.match(markup, /Tesla live focus/);
  assert.match(markup, /Matched legal entity .*Tesla Manufacturing LLC/);
});

test("renders alias-hit explanations for suggest-style quick access items without blank canonical labels", () => {
  const companies = adaptCompanyOptions({
    items: [
      {
        id: "company:GOOG",
        label: "Google (GOOG)",
        secondaryLabel: "Alphabet",
        ticker: "GOOG",
        isMag7: true,
        match: {
          field: "alias",
          value: "Google LLC",
          aliasType: "legal_entity",
          explanation: 'Matched legal entity "Google LLC" for canonical "Alphabet" and display "Google".',
        },
      },
    ],
    total: 1,
    query: "google llc",
    source: "mock",
  });
  const graph = adaptGraphViewModel({
    company: {
      item: {
        ...getCompanyResponse("company:TSLA").item,
        id: "company:GOOG",
        ticker: "GOOG",
        name: "Alphabet",
        canonicalName: "Alphabet",
        displayName: "Google",
        entityProfile: {
          canonicalName: "Alphabet",
          displayName: "Google",
          legalEntities: [
            {
              id: "alias:google-llc",
              name: "Google LLC",
              normalizedName: "google llc",
              aliasType: "legal_entity",
              isPrimary: true,
            },
          ],
          brands: [],
          aliases: [],
        },
      },
      source: "mock",
    },
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    focusCompanyOption: companies[0],
    query: {
      companyId: "company:GOOG",
      depth: 2,
      search: "google llc",
    },
  });

  const topBarMarkup = renderToStaticMarkup(
    React.createElement(TopBar, {
      companies,
      depth: 2,
      filtersOpen: false,
      graph,
      onCompanySelect() {},
      onDepthChange() {},
      onFiltersClear() {},
      onFiltersToggle() {},
      onRelationshipSubtypeChange() {},
      onRelationshipTypeToggle() {},
      onSearchChange() {},
      relationshipSubtype: null,
      relationshipSubtypeOptions: graph.relationshipSubtypeOptions,
      relationshipTypes: [],
      relationTypeOptions: graph.relationTypeOptions,
      search: "google llc",
      selectedCompanyId: "company:GOOG",
    }),
  );

  const sidebarMarkup = renderToStaticMarkup(
    React.createElement(CompanySidebar, {
      activeNode: null,
      activeRelation: null,
      activeTab: "overview",
      company: graph.focusCompany,
      evidence: [],
      evidenceSummary: graph.evidenceOverview,
      onRelationSelect() {},
      onTabChange() {},
      relations: graph.relations,
    }),
  );

  assert.match(topBarMarkup, />Google</);
  assert.match(topBarMarkup, />Alphabet</);
  assert.match(topBarMarkup, /Matched legal entity .*Google LLC/);
  assert.doesNotMatch(topBarMarkup, />undefined</);
  assert.match(sidebarMarkup, /<h3>Google<\/h3>/);
  assert.match(sidebarMarkup, />Alphabet</);
  assert.match(sidebarMarkup, /Matched legal entity .*Google LLC/);
});

test("renders graph legend with concrete relationship labels instead of generic buckets", () => {
  const graph = adaptGraphViewModel({
    company: getCompanyResponse("company:TSLA"),
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
    },
  });

  const markup = renderToStaticMarkup(
    React.createElement(GraphCanvas, {
      activeNodeId: graph.focusCompany.id,
      activeRelationId: graph.relations[0]?.id ?? null,
      focusNode: graph.nodes[0],
      graph,
      onNodeSelect() {},
      onRelationSelect() {},
      onZoomChange() {},
      zoom: 1,
    }),
  );

  assert.match(markup, /Component Supply/);
  assert.match(markup, /Raw Material Supply/);
  assert.doesNotMatch(markup, />Supply</);
  assert.doesNotMatch(markup, /IP \/ Technology/);
  assert.match(markup, /group anchors, brand\/legal naming, and facility operators/i);
});

test("renders service relationships with service semantics instead of component-supply language", () => {
  const markup = renderToStaticMarkup(
    React.createElement(EvidencePanel, {
      evidence: [],
      relation: {
        id: "rel:service",
        sourceId: "company:service",
        targetId: "company:MSFT",
        relationshipType: "professional_service",
        relationshipTypeLabel: "Professional Service",
        relationshipSemanticLabel: "Professional or advisory service",
        relationshipSubtype: "legal_counsel",
        relationshipSubtypeLabel: "Legal Counsel",
        tier: 1,
        depthFromMag7: 1,
        confidence: "confirmed",
        confidenceScore: 0.9,
        summary: "Outside counsel supports a compliance workstream.",
        productScope: ["Regulatory"],
        notes: null,
        sourceMethod: "direct_disclosure",
        sourceMethodLabel: "Direct Disclosure",
        evidenceDateResolution: "day",
        evidenceDateResolutionLabel: "Day-level",
        validFrom: "2025-01-01",
        validFromResolution: "day",
        validFromResolutionLabel: "Day-level",
        validTo: null,
        validToResolution: null,
        validToResolutionLabel: null,
        validityLabel: "2025-01-01 onward",
        validityNote: "Relationship remains active unless superseded by a later filing.",
        evidenceCount: 0,
        evidence: [],
        isDirectRelation: true,
      },
    }),
  );

  assert.match(markup, /Professional or advisory service/);
  assert.match(markup, /Professional Service/);
  assert.doesNotMatch(markup, /Component Supply/);
  assert.match(markup, /Day-level/);
  assert.match(markup, /2025-01-01 onward/);
  assert.match(markup, /Validity note/);
});

test("renders entity-layer guidance in the company sidebar without falling back to aliases[0]", () => {
  const graph = adaptGraphViewModel({
    company: {
      item: {
        ...getCompanyResponse("company:TSLA").item,
        name: "Tesla, Inc.",
        canonicalName: "Tesla, Inc.",
        displayName: "Tesla Energy",
        aliases: ["Legacy Alias"],
        entityProfile: {
          canonicalName: "Tesla, Inc.",
          displayName: "Tesla Energy",
          legalEntities: [
            {
              id: "alias:legal",
              name: "Tesla Manufacturing LLC",
              normalizedName: "tesla manufacturing llc",
              aliasType: "legal_entity",
              isPrimary: true,
            },
          ],
          brands: [
            {
              id: "alias:brand",
              name: "Powerwall",
              normalizedName: "powerwall",
              aliasType: "brand",
              isPrimary: true,
            },
          ],
          aliases: [
            {
              id: "alias:facility",
              name: "Gigafactory Texas",
              normalizedName: "gigafactory texas",
              aliasType: "facility",
              isPrimary: false,
            },
          ],
        },
      },
      source: "mock",
    },
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    focusCompanyOption: {
      id: "company:TSLA",
      ticker: "TSLA",
      name: "Tesla, Inc.",
      displayName: "Tesla Energy",
      canonicalName: "Tesla, Inc.",
      shortName: "Tesla Energy",
      focus: "Tesla Energy",
      searchMatch: {
        field: "alias",
        value: "Tesla Manufacturing LLC",
        aliasType: "legal_entity",
        explanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla, Inc." and display "Tesla Energy".',
      },
      aliasHitExplanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla, Inc." and display "Tesla Energy".',
      hierarchySummary: "Group: Tesla, Inc.",
      primaryRegion: "North America",
      marketCapUsd: 1000,
      isMag7: true,
      entityProfile: {
        canonicalName: "Tesla, Inc.",
        displayName: "Tesla Energy",
        legalEntities: [
          {
            id: "alias:legal",
            name: "Tesla Manufacturing LLC",
            normalizedName: "tesla manufacturing llc",
            aliasType: "legal_entity",
            isPrimary: true,
          },
        ],
        brands: [
          {
            id: "alias:brand",
            name: "Powerwall",
            normalizedName: "powerwall",
            aliasType: "brand",
            isPrimary: true,
          },
        ],
        aliases: [
          {
            id: "alias:facility",
            name: "Gigafactory Texas",
            normalizedName: "gigafactory texas",
            aliasType: "facility",
            isPrimary: false,
          },
        ],
      },
    },
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
    },
  });

  const markup = renderToStaticMarkup(
    React.createElement(CompanySidebar, {
      activeNode: graph.nodes[0],
      activeRelation: graph.relations[0],
      activeTab: "overview",
      company: graph.focusCompany,
      evidence: [],
      evidenceSummary: graph.evidenceOverview,
      onRelationSelect() {},
      onTabChange() {},
      relations: graph.relations,
    }),
  );

  assert.match(markup, /Tesla Energy/);
  assert.match(markup, /Tesla, Inc\./);
  assert.match(markup, /Group \/ brand \/ legal entity \/ facility/);
  assert.match(markup, /Gigafactory Texas/);
  assert.match(markup, /Matched legal entity .*Tesla Manufacturing LLC/);
  assert.doesNotMatch(markup, /Legacy Alias/);
});

test("renders evidence provenance semantics for published, reported-period, retrieved, and normalized dates", () => {
  const markup = renderToStaticMarkup(
    React.createElement(EvidencePanel, {
      relation: null,
      evidence: [
        {
          id: "evidence:date-semantics",
          title: "Undated supplier policy",
          publisher: "Example Publisher",
          sourceType: "official_doc",
          sourceTypeLabel: "Official Document",
          publishedAt: "2026-06-01T00:00:00.000Z",
          publishedAtResolution: "undated",
          publishedAtResolutionLabel: "Undated / Retrieved surrogate",
          publishedAtSemantic: "retrieved_at_surrogate",
          reportedPeriodEnd: "2025-03-31",
          reportedPeriodEndResolutionLabel: "Day-level",
          retrievedAt: "2026-06-14T00:00:00.000Z",
          retrievedAtSemantic: "retrieved_at_surrogate",
          compatibilityNote:
            "Legacy month-normalized inputs are rendered as month-level values; 2025-03-01 may be a surrogate boundary, not a day-exact publication timestamp.",
          url: "https://example.com/policy",
          citation: "Example citation",
          excerpt: "Example excerpt",
          pageRef: null,
          confidence: "confirmed",
        },
      ],
    }),
  );

  assert.match(markup, /Primary date semantic/);
  assert.match(markup, /retrieved_at_surrogate/);
  assert.match(markup, /reported_period_end/);
  assert.match(markup, /month-normalized compatibility/);
  assert.match(markup, /Legacy month-normalized inputs are rendered as month-level values/);
});

test("renders sku granularity labels, source info, and boundary hints in relation and evidence panels", () => {
  const relation = {
    id: "rel:sku-family",
    sourceId: "company:SUP",
    targetId: "company:NVDA",
    relationshipType: "component_supply",
    relationshipTypeLabel: "Component Supply",
    relationshipSemanticLabel: "Component supply for a network platform",
    relationshipSubtype: "optical_module",
    relationshipSubtypeLabel: "Optical Module",
    tier: 1,
    depthFromMag7: 1,
    confidence: "confirmed",
    confidenceScore: 0.94,
    summary: "Supplier supports the Quantum platform optical module family.",
    productScope: ["Quantum-X800"],
    notes: null,
    sourceMethod: "direct_disclosure",
    sourceMethodLabel: "Direct Disclosure",
    evidenceDateResolution: "day",
    evidenceDateResolutionLabel: "Day-level",
    validFrom: "2025-01-01",
    validFromResolution: "day",
    validFromResolutionLabel: "Day-level",
    validTo: null,
    validToResolution: null,
    validToResolutionLabel: null,
    validityLabel: "2025-01-01 onward",
    validityNote: "Family scope only.",
    evidenceCount: 1,
    evidence: [],
    isDirectRelation: true,
    skuGranularityValue: "family_only",
    skuGranularityLabel: "仅家族层级",
    skuGranularitySource: "authoritative_manifest",
    skuGranularitySourceLabel: "权威 manifest 回填",
    skuGranularityNote: "Backfilled from full.15 authoritative manifest mapping.",
    skuGranularityBoundaryHint: "仅家族层级：不可视为具体目标 SKU vendor 锁定",
    skuGranularityIsBackfilled: true,
  };

  const evidence = [
    {
      id: "evidence:legacy-sku",
      title: "Legacy appendix",
      publisher: "Example Publisher",
      sourceType: "official_doc",
      sourceTypeLabel: "Official Document",
      publishedAt: "2026-06-01T00:00:00.000Z",
      publishedAtResolution: "undated",
      publishedAtResolutionLabel: "Undated / Retrieved surrogate",
      publishedAtSemantic: "retrieved_at_surrogate",
      reportedPeriodEnd: null,
      reportedPeriodEndResolutionLabel: null,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      retrievedAtSemantic: "retrieved_at_surrogate",
      compatibilityNote: null,
      url: "https://example.com/legacy",
      citation: "Legacy appendix citation",
      excerpt: "Legacy appendix excerpt",
      pageRef: null,
      confidence: "confirmed",
      skuGranularityValue: "documented_legacy_only",
      skuGranularityLabel: "仅旧文档留痕",
      skuGranularitySource: "legacy_note_backfill",
      skuGranularitySourceLabel: "旧注释回填",
      skuGranularityRaw: "target_sku_or_official_component",
      skuGranularityNote: "Legacy note retained for compatibility only.",
      skuGranularityBoundaryHint: "仅旧文档留痕：只用于兼容旧记录，不构成新的正式归类",
      skuGranularityIsBackfilled: true,
    },
  ];

  const relationsMarkup = renderToStaticMarkup(
    React.createElement(RelationsPanel, {
      relations: [relation],
      selectedRelationId: relation.id,
      onSelect() {},
    }),
  );
  const evidenceMarkup = renderToStaticMarkup(
    React.createElement(EvidencePanel, {
      relation,
      evidence,
    }),
  );

  assert.match(relationsMarkup, /仅家族层级/);
  assert.match(relationsMarkup, /粒度来源：权威 manifest 回填 · 已回填/);
  assert.match(relationsMarkup, /不可视为具体目标 SKU vendor 锁定/);
  assert.match(evidenceMarkup, /SKU 粒度/);
  assert.match(evidenceMarkup, /仅旧文档留痕/);
  assert.match(evidenceMarkup, /旧注释值/);
  assert.match(evidenceMarkup, /target_sku_or_official_component/);
  assert.match(evidenceMarkup, /只用于兼容旧记录，不构成新的正式归类/);
});
