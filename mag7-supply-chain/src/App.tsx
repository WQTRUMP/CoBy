import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { CompanySidebar } from "./components/CompanySidebar";
import { GraphCanvas } from "./components/GraphCanvas";
import { StatusStrip } from "./components/StatusStrip";
import { TopBar } from "./components/TopBar";
import { useGraphExplorer } from "./hooks/useGraphExplorer";
import { mockGraphExplorerApi } from "./services/mockGraphExplorerApi";
import type { GraphNodeDTO, GraphRelationDTO } from "./types/contracts";

export function App() {
  const [selectedCompanyId, setSelectedCompanyId] = useState("tsla");
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "financials">("overview");
  const deferredSearch = useDeferredValue(search);

  const explorer = useGraphExplorer(
    mockGraphExplorerApi,
    useMemo(
      () => ({
        companyId: selectedCompanyId,
        depth,
        search: deferredSearch,
      }),
      [deferredSearch, depth, selectedCompanyId],
    ),
  );

  const graph = explorer.graph;
  const [activeNodeId, setActiveNodeId] = useState("tsla");
  const [activeRelationId, setActiveRelationId] = useState<string | null>(null);

  const activeNode = graph?.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activeRelation = graph?.relations.find((relation) => relation.id === activeRelationId) ?? graph?.relations[0] ?? null;
  const activeEvidence = useMemo(
    () => graph?.evidence.filter((item) => activeRelation?.evidenceIds.includes(item.id)) ?? [],
    [activeRelation, graph?.evidence],
  );

  function handleCompanySelect(companyId: string) {
    startTransition(() => {
      setSelectedCompanyId(companyId);
      setActiveNodeId(companyId);
      setActiveRelationId(null);
      setActiveTab("overview");
      setZoom(1);
    });
  }

  function handleNodeSelect(node: GraphNodeDTO) {
    setActiveNodeId(node.id);
    const relation = graph?.relations.find((item) => item.sourceId === node.id || item.targetId === node.id) ?? null;
    setActiveRelationId(relation?.id ?? null);
    setActiveTab(relation ? "evidence" : "overview");
  }

  function handleRelationSelect(relation: GraphRelationDTO) {
    setActiveRelationId(relation.id);
    setActiveNodeId(relation.targetId);
    setActiveTab("evidence");
  }

  if (!graph) {
    return <div className="loadingShell">Loading graph shell…</div>;
  }

  const evidenceSummary = {
    confirmed: graph.evidence.filter((item) => item.confidence === "confirmed").length,
    strongEvidence: graph.evidence.filter((item) => item.confidence === "strong_evidence").length,
    inferred: graph.evidence.filter((item) => item.confidence === "inferred").length,
  };

  const focusNode = activeNode ?? graph.nodes[0];

  return (
    <main className="atlasPage">
      <TopBar
        companies={explorer.companies}
        depth={depth}
        graph={graph}
        onCompanySelect={handleCompanySelect}
        onDepthChange={setDepth}
        onSearchChange={setSearch}
        search={search}
        selectedCompanyId={selectedCompanyId}
      />

      <StatusStrip graph={graph} />

      <section className="capabilitySection">
        <article className="capabilityCard">
          <span className="capabilityIcon">01</span>
          <h2>Interactive Network</h2>
          <p>Expand supplier layers from any Mag7 anchor without collapsing the graph container into a static list.</p>
        </article>
        <article className="capabilityCard">
          <span className="capabilityIcon">02</span>
          <h2>Evidence-backed</h2>
          <p>Every relation keeps a source card path ready for filings, earnings calls, supplier reports, and media citations.</p>
        </article>
        <article className="capabilityCard">
          <span className="capabilityIcon">03</span>
          <h2>Financial Insights</h2>
          <p>Market-cap sizing, relationship counts, and company-level risk summaries stay available beside the graph.</p>
        </article>
        <article className="capabilityCard">
          <span className="capabilityIcon">04</span>
          <h2>Risk &amp; Resilience</h2>
          <p>Confidence badges and tier encoding make single-point-of-failure analysis visible before live data wiring.</p>
        </article>
      </section>

      <section className="workspaceBoard">
        <div className="workspaceIntro">
          <div>
            <p className="sectionEyebrow">Global Supply Chain Map</p>
            <h2>Fullscreen graph exploration with an overlay evidence rail</h2>
          </div>
          <p>
            The graph canvas remains the primary surface. Company context, evidence, and financial placeholders slide over the
            workspace on desktop and stack below on mobile.
          </p>
        </div>

        <GraphCanvas
          activeNodeId={activeNodeId}
          activeRelationId={activeRelation?.id ?? null}
          focusNode={focusNode}
          graph={graph}
          onNodeSelect={handleNodeSelect}
          onRelationSelect={handleRelationSelect}
          onZoomChange={setZoom}
          zoom={zoom}
        />

        <CompanySidebar
          activeNode={activeNode}
          activeRelation={activeRelation}
          activeTab={activeTab}
          company={graph.company}
          evidence={activeEvidence}
          evidenceSummary={evidenceSummary}
          onRelationSelect={handleRelationSelect}
          onTabChange={setActiveTab}
          relations={graph.relations}
        />
      </section>

      {explorer.loading ? <div className="loadingToast">Refreshing graph…</div> : null}
    </main>
  );
}
