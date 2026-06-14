import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptCompanyOptions,
  adaptCompanyOverview,
  adaptCompanyProfile,
  adaptGraphViewModel,
  adaptRelationEvidence,
} from "../.tmp-contract-tests/src/adapters/graphExplorerAdapter.js";
import {
  getCompaniesResponse,
  getCompanyOverviewResponse,
  getCompanyResponse,
  getRelationEvidenceResponse,
  getSubgraphResponse,
} from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

test("adapts company list items from shared contract responses", () => {
  const companies = adaptCompanyOptions(getCompaniesResponse());

  assert.equal(companies[0]?.id, "company:TSLA");
  assert.equal(companies[0]?.shortName, "Tesla");
  assert.equal(companies[0]?.displayName, "Tesla");
  assert.equal(companies[0]?.canonicalName, "Tesla");
  assert.equal(companies[0]?.aliasHitExplanation, null);
  assert.equal(companies[0]?.primaryRegion, "North America");
});

test("uses displayName for company list short names instead of aliases[0]", () => {
  const companies = adaptCompanyOptions({
    items: [
      {
        id: "company:GOOG",
        name: "Alphabet",
        canonicalName: "Alphabet",
        displayName: "Google",
        aliases: ["Alphabet Inc.", "Google"],
        ticker: "GOOG",
        isMag7: true,
        primaryRegion: "North America",
        marketCapUsd: 1000,
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
          brands: [
            {
              id: "alias:google-cloud",
              name: "Google Cloud",
              normalizedName: "google cloud",
              aliasType: "brand",
              isPrimary: true,
            },
          ],
          aliases: [],
        },
      },
    ],
    total: 1,
    source: "mock",
  });

  assert.equal(companies[0]?.displayName, "Google");
  assert.equal(companies[0]?.shortName, "Google");
  assert.equal(companies[0]?.canonicalName, "Alphabet");
  assert.equal(companies[0]?.aliasHitExplanation, null);
  assert.doesNotMatch(companies[0]?.hierarchySummary ?? "", /Alphabet Inc\./);
  assert.match(companies[0]?.hierarchySummary ?? "", /Google LLC/);
  assert.match(companies[0]?.hierarchySummary ?? "", /Google Cloud/);
});

test("preserves alias-hit explanations from search results while keeping displayName as the primary label", () => {
  const companies = adaptCompanyOptions({
    items: [
      {
        id: "company:GOOG",
        ticker: "GOOG",
        name: "Alphabet",
        canonicalName: "Alphabet",
        displayName: "Google",
        isMag7: true,
        marketCapUsd: 1000,
        primaryRegion: "North America",
        activeSnapshotId: "snapshot:published",
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

  assert.equal(companies[0]?.displayName, "Google");
  assert.equal(companies[0]?.canonicalName, "Alphabet");
  assert.equal(companies[0]?.aliasHitExplanation, 'Matched legal entity "Google LLC" for canonical "Alphabet" and display "Google".');
  assert.equal(companies[0]?.searchMatch?.field, "alias");
});

test("prefers displayName and canonical entity profile fields over aliases for company presentation", () => {
  const company = adaptCompanyProfile(
    {
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
    getCompanyOverviewResponse("company:TSLA"),
  );

  assert.equal(company.displayName, "Tesla Energy");
  assert.equal(company.canonicalName, "Tesla, Inc.");
  assert.equal(company.shortName, "Tesla Energy");
  assert.equal(company.aliasHitExplanation, null);
  assert.match(company.hierarchySummary, /Group: Tesla, Inc\./);
  assert.match(company.hierarchySummary, /Facilities: Gigafactory Texas/);
});

test("carries selected-company alias-hit explanations into the focus company profile", () => {
  const company = adaptCompanyProfile(
    getCompanyResponse("company:TSLA"),
    getCompanyOverviewResponse("company:TSLA"),
    {
      id: "company:TSLA",
      ticker: "TSLA",
      name: "Tesla, Inc.",
      displayName: "Tesla",
      canonicalName: "Tesla, Inc.",
      shortName: "Tesla",
      focus: "Tesla",
      searchMatch: {
        field: "alias",
        value: "Tesla Manufacturing LLC",
        aliasType: "legal_entity",
        explanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla, Inc." and display "Tesla".',
      },
      aliasHitExplanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla, Inc." and display "Tesla".',
      hierarchySummary: "Group: Tesla, Inc.",
      primaryRegion: "North America",
      marketCapUsd: 1000,
      isMag7: true,
      entityProfile: getCompanyResponse("company:TSLA").item.entityProfile,
    },
  );

  assert.equal(company.displayName, "Tesla");
  assert.equal(company.aliasHitExplanation, 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla, Inc." and display "Tesla".');
  assert.equal(company.searchMatch?.field, "alias");
});

test("preserves non-direct relations, notes, tier, and evidence aggregation in the graph view-model", () => {
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

  const upstreamRelation = graph.relations.find((relation) => relation.id === "rel:ganfeng-catl");
  assert.ok(upstreamRelation);
  assert.equal(upstreamRelation.isDirectRelation, false);
  assert.equal(upstreamRelation.tier, 2);
  assert.equal(upstreamRelation.notes, "This non-direct edge must stay visible when the subgraph includes upstream chains.");
  assert.deepEqual(upstreamRelation.productScope, ["Lithium compounds"]);
  assert.equal(upstreamRelation.relationshipSubtype, "lithium_feedstock");
  assert.equal(upstreamRelation.relationshipSubtypeLabel, "Lithium Feedstock");
  assert.equal(upstreamRelation.sourceMethod, "mock_frontend_fixture");
  assert.equal(upstreamRelation.sourceMethodLabel, "Mock Frontend Fixture");
  assert.equal(upstreamRelation.evidenceDateResolution, "quarter");
  assert.equal(upstreamRelation.evidenceDateResolutionLabel, "Quarter-level");
  assert.equal(upstreamRelation.validFrom, "2024-01-01");
  assert.equal(upstreamRelation.validFromResolution, null);
  assert.equal(upstreamRelation.validFromResolutionLabel, null);
  assert.equal(upstreamRelation.validityLabel, "2024-01-01 onward");

  assert.equal(graph.focusCompany.overview.relationCount, 3);
  assert.deepEqual(graph.evidenceOverview, {
    confirmed: 2,
    strongEvidence: 4,
    inferred: 0,
  });
});

test("maps company detail and overview into a dedicated company profile view-model", () => {
  const company = adaptCompanyProfile(getCompanyResponse("company:TSLA"), getCompanyOverviewResponse("company:TSLA"));
  const overview = adaptCompanyOverview(getCompanyOverviewResponse("company:TSLA"));

  assert.equal(company.id, "company:TSLA");
  assert.equal(company.overview.evidenceCoverage, 1);
  assert.equal(company.apiBindings.overviewEndpoint, "/api/v1/companies/company:TSLA/overview");
  assert.equal(overview.source, "mock");
});

test("aggregates confirmed, strong evidence, and inferred counts without reading raw evidence ids", () => {
  const subgraph = getSubgraphResponse("company:TSLA", 2, true);
  subgraph.relations.push({
    ...subgraph.relations[0],
    id: "rel:tesla-inferred",
    sourceId: "company:TSLA",
    targetId: "company:Ganfeng",
    confidence: "inferred",
    confidenceScore: 0.34,
    summary: "Inferred upstream dependence for test coverage.",
    evidence: [],
    evidenceCount: 1,
    evidenceIds: [],
  });

  const graph = adaptGraphViewModel({
    company: getCompanyResponse("company:TSLA"),
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph,
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
    },
  });

  assert.deepEqual(graph.evidenceOverview, {
    confirmed: 2,
    strongEvidence: 4,
    inferred: 1,
  });
});

test("maps relation evidence endpoint payloads into evidence cards with relation confidence", () => {
  const evidence = adaptRelationEvidence(getRelationEvidenceResponse("rel:tesla-panasonic"), {
    confidence: "strong_evidence",
  });

  assert.equal(evidence.length, 3);
  assert.equal(evidence[0]?.sourceTypeLabel, "10-K");
  assert.equal(evidence[0]?.confidence, "strong_evidence");
  assert.equal(evidence[0]?.publishedAtSemantic, "day");
  assert.equal(
    evidence.find((item) => item.sourceType === "official_doc")?.sourceTypeLabel,
    "Official Document",
  );
});

test("keeps the official_doc contract source type mapped for frontend evidence cards", () => {
  const evidence = adaptRelationEvidence(
    {
      items: [
        {
          id: "evidence:official-doc-regression",
          sourceType: "official_doc",
          title: "Supplier Due Diligence Statement",
          publisher: "Tesla",
          url: "https://www.tesla.com/legal/supply-chain",
          publishedAt: "2025-11-01T00:00:00.000Z",
          retrievedAt: "2026-06-14T00:00:00.000Z",
          excerpt: "Regression fixture for the frontend source type label adapter.",
          pageRef: "Battery materials due diligence",
          language: "en",
          hash: "sha256:official-doc-regression",
          sourceDomain: "tesla.com",
          citationText: "Regression fixture for the frontend source type label adapter.",
          reliabilityTier: 1,
          licenseNote: null,
          parserVersion: "contract-test",
        },
      ],
      total: 1,
      source: "contract-test",
      generatedAt: "2026-06-14T00:00:00.000Z",
    },
    { confidence: "confirmed" },
  );

  assert.equal(evidence[0]?.sourceType, "official_doc");
  assert.equal(evidence[0]?.sourceTypeLabel, "Official Document");
});

test("maps evidence date semantics and compatibility notes for reported periods and normalized surrogates", () => {
  const evidence = adaptRelationEvidence(
    {
      items: [
        {
          id: "evidence:filing-period",
          sourceType: "supplier_report",
          title: "Quarterly Supplier Summary",
          publisher: "Test Supplier",
          url: "https://example.com/report",
          publishedAt: "2025-03-31",
          publishedAtResolution: "filing_period",
          coverageStart: "2025-01-01",
          coverageEnd: "2025-03-31",
          coverageStartResolution: "day",
          coverageEndResolution: "day",
          retrievedAt: "2026-06-14T00:00:00.000Z",
          excerpt: "Fixture for filing period semantics.",
          pageRef: null,
          language: "en",
          hash: "sha256:filing-period",
          sourceDomain: "example.com",
          citationText: "Fixture for filing period semantics.",
          reliabilityTier: 2,
          licenseNote: null,
          parserVersion: "contract-test",
        },
        {
          id: "evidence:retrieved-surrogate",
          sourceType: "official_doc",
          title: "Undated policy page",
          publisher: "Example Policy",
          url: "https://example.com/policy",
          publishedAt: "2026-06-01T00:00:00.000Z",
          publishedAtResolution: "undated",
          coverageStart: null,
          coverageEnd: null,
          coverageStartResolution: null,
          coverageEndResolution: null,
          retrievedAt: "2026-06-14T00:00:00.000Z",
          excerpt: "Fixture for undated evidence fallback semantics.",
          pageRef: null,
          language: "en",
          hash: "sha256:retrieved-surrogate",
          sourceDomain: "example.com",
          citationText: "Fixture for undated evidence fallback semantics.",
          reliabilityTier: 1,
          licenseNote: null,
          parserVersion: "contract-test",
        },
        {
          id: "evidence:normalized-month",
          sourceType: "media",
          title: "Monthly industry note",
          publisher: "Example Media",
          url: "https://example.com/monthly",
          publishedAt: "2025-03-01",
          publishedAtResolution: "month",
          coverageStart: null,
          coverageEnd: null,
          coverageStartResolution: null,
          coverageEndResolution: null,
          retrievedAt: "2026-06-14T00:00:00.000Z",
          excerpt: "Fixture for normalized month compatibility.",
          pageRef: null,
          language: "en",
          hash: "sha256:normalized-month",
          sourceDomain: "example.com",
          citationText: "Fixture for normalized month compatibility.",
          reliabilityTier: 2,
          licenseNote: null,
          parserVersion: "contract-test",
        },
      ],
      total: 3,
      source: "contract-test",
      generatedAt: "2026-06-14T00:00:00.000Z",
    },
    { confidence: "confirmed" },
  );

  assert.equal(evidence[0]?.publishedAtSemantic, "reported_period_end");
  assert.equal(evidence[0]?.reportedPeriodEnd, "2025-03-31");
  assert.match(evidence[0]?.compatibilityNote ?? "", /reported period end/);
  assert.equal(evidence[1]?.publishedAtSemantic, "retrieved_at_surrogate");
  assert.match(evidence[1]?.compatibilityNote ?? "", /retrieved_at surrogate/i);
  assert.equal(evidence[2]?.publishedAtSemantic, "month-normalized compatibility");
  assert.match(evidence[2]?.compatibilityNote ?? "", /month-normalized/);
});

test("filters graph relations by relationship type and subtype while preserving filter options", () => {
  const graph = adaptGraphViewModel({
    company: getCompanyResponse("company:TSLA"),
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
      relationshipTypes: ["component_supply"],
      relationshipSubtype: "battery_cells",
    },
  });

  assert.equal(graph.relations.length, 1);
  assert.equal(graph.relations[0]?.relationshipType, "component_supply");
  assert.equal(graph.relations[0]?.relationshipSubtype, "battery_cells");
  assert.deepEqual(
    graph.relationshipSubtypeOptions.map((option) => option.value),
    ["battery_cells", "lfp_cells"],
  );
});
