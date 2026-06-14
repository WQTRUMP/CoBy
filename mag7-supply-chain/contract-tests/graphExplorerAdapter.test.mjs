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
  assert.equal(companies[0]?.primaryRegion, "North America");
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
  assert.equal(
    evidence.find((item) => item.sourceType === "official_doc")?.sourceTypeLabel,
    "Official Document",
  );
});
