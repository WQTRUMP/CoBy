import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CompanySidebar,
  getNextCompanySidebarTab,
} from "../.tmp-contract-tests/src/components/CompanySidebar.js";
import { adaptGraphViewModel } from "../.tmp-contract-tests/src/adapters/graphExplorerAdapter.js";
import {
  getCompanyOverviewResponse,
  getCompanyResponse,
  getSubgraphResponse,
} from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

function buildGraph() {
  return adaptGraphViewModel({
    company: getCompanyResponse("company:TSLA"),
    overview: getCompanyOverviewResponse("company:TSLA"),
    subgraph: getSubgraphResponse("company:TSLA", 2, true),
    query: {
      companyId: "company:TSLA",
      depth: 2,
      search: "",
    },
  });
}

test("cycles company sidebar tabs with ArrowLeft and ArrowRight", () => {
  assert.equal(getNextCompanySidebarTab("overview", "ArrowRight"), "evidence");
  assert.equal(getNextCompanySidebarTab("evidence", "ArrowRight"), "financials");
  assert.equal(getNextCompanySidebarTab("financials", "ArrowRight"), "overview");
  assert.equal(getNextCompanySidebarTab("overview", "ArrowLeft"), "financials");
  assert.equal(getNextCompanySidebarTab("financials", "ArrowLeft"), "evidence");
  assert.equal(getNextCompanySidebarTab("overview", "Enter"), null);
});

test("renders a single active tab in the company sidebar roving tabindex set", () => {
  const graph = buildGraph();
  const markup = renderToStaticMarkup(
    React.createElement(CompanySidebar, {
      activeNode: graph.nodes[0],
      activeRelation: graph.relations[0],
      activeTab: "evidence",
      company: graph.focusCompany,
      evidence: [],
      evidenceError: null,
      evidenceLoading: false,
      evidenceSummary: graph.evidenceOverview,
      isOpen: true,
      onClose() {},
      onRelationSelect() {},
      onRetryEvidence() {},
      onTabChange() {},
      relations: graph.relations,
    }),
  );

  assert.ok(
    markup.includes(
      '<button aria-controls="company-panel-overview" aria-selected="false" class="tabButton" id="company-tab-overview" role="tab" tabindex="-1" type="button">Overview</button>',
    ),
  );
  assert.ok(
    markup.includes(
      '<button aria-controls="company-panel-evidence" aria-selected="true" class="tabButton active" id="company-tab-evidence" role="tab" tabindex="0" type="button">Evidence</button>',
    ),
  );
  assert.ok(
    markup.includes(
      '<button aria-controls="company-panel-financials" aria-selected="false" class="tabButton" id="company-tab-financials" role="tab" tabindex="-1" type="button">Financials</button>',
    ),
  );
});
