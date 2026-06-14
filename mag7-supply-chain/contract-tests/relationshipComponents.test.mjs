import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EvidencePanel } from "../.tmp-contract-tests/src/components/EvidencePanel.js";
import { GraphCanvas } from "../.tmp-contract-tests/src/components/GraphCanvas.js";
import { TopBar } from "../.tmp-contract-tests/src/components/TopBar.js";
import { adaptGraphViewModel } from "../.tmp-contract-tests/src/adapters/graphExplorerAdapter.js";
import {
  getCompaniesResponse,
  getCompanyOverviewResponse,
  getCompanyResponse,
  getSubgraphResponse,
} from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

test("renders relationship filters with real type and subtype options", () => {
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
    React.createElement(TopBar, {
      companies: graph.focusCompany ? [] : [],
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
        validTo: null,
        validityLabel: "2025-01-01 onward",
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
});
