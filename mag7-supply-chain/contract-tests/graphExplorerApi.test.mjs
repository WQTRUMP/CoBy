import assert from "node:assert/strict";
import test from "node:test";

import { createHttpGraphExplorerApi, graphApiContract } from "../.tmp-contract-tests/src/services/graphExplorerApi.js";
import {
  getCompaniesResponse,
  getCompanyOverviewResponse,
  getCompanyResponse,
  getRelationEvidenceResponse,
  getSubgraphResponse,
} from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

globalThis.window = { location: { origin: "https://atlas.example" } };

test("uses search results for non-empty company queries and preserves the rest of the graph contract flow", async () => {
  const requests = [];
  const api = createHttpGraphExplorerApi("https://api.example");

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url === "https://api.example/api/v1/companies/company%3ATSLA") {
      return response(getCompanyResponse("company:TSLA"));
    }
    if (url === "https://api.example/api/v1/companies/company%3ATSLA/overview") {
      return response(getCompanyOverviewResponse("company:TSLA"));
    }
    if (url.startsWith("https://api.example/api/v1/graph/subgraph?")) {
      return response(getSubgraphResponse("company:TSLA", 2, true));
    }
    if (url === "https://api.example/api/v1/relations/rel%3Atesla-panasonic/evidence") {
      return response(getRelationEvidenceResponse("rel:tesla-panasonic"));
    }
    if (url.startsWith(`https://api.example${graphApiContract.companySearch}`)) {
      return response({
        items: [
          {
            ...getCompaniesResponse("tesla").items[0],
            match: {
              field: "alias",
              value: "Tesla Manufacturing LLC",
              aliasType: "legal_entity",
              explanation: 'Matched legal entity "Tesla Manufacturing LLC" for canonical "Tesla" and display "Tesla".',
            },
          },
        ],
        total: 1,
        query: "tesla",
        source: "mock",
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const companies = await api.listCompanies("tesla");
  const company = await api.getCompany("company:TSLA");
  const overview = await api.getCompanyOverview("company:TSLA");
  const subgraph = await api.getSubgraph({
    companyId: "company:TSLA",
    depth: 2,
    relationshipTypes: ["component_supply", "raw_material_supply"],
    snapshot: "published",
  });
  const evidence = await api.getRelationEvidence("rel:tesla-panasonic");

  assert.equal(companies.items[0]?.id, "company:TSLA");
  assert.equal(company.item.primaryRegion, "North America");
  assert.equal(overview.highRiskRelationCount, 1);
  assert.equal(subgraph.relations.length, 3);
  assert.equal(evidence.total, 3);

  assert.match(requests[0], /\/api\/v1\/companies\/search\?q=tesla&limit=10$/);
  assert.match(requests[3], /includeEvidence=true/);
  assert.match(requests[3], /relationshipTypes=component_supply/);
  assert.match(requests[3], /relationshipTypes=raw_material_supply/);
  assert.equal(companies.items[0]?.match?.field, "alias");
});

test("uses the plain companies list endpoint when no search query is provided", async () => {
  const requests = [];
  const api = createHttpGraphExplorerApi("https://api.example");

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url === `https://api.example${graphApiContract.companies}`) {
      return response(getCompaniesResponse());
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const companies = await api.listCompanies();

  assert.equal(companies.items[0]?.id, "company:TSLA");
  assert.equal(requests[0], `https://api.example${graphApiContract.companies}`);
});

function response(payload) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return payload;
    },
  };
}
