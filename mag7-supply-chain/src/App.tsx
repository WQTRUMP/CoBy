import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { CompanySidebar } from "./components/CompanySidebar";
import { GraphCanvas } from "./components/GraphCanvas";
import { StatusStrip } from "./components/StatusStrip";
import { TopBar } from "./components/TopBar";
import { useGraphExplorer } from "./hooks/useGraphExplorer";
import { createHttpGraphExplorerApi } from "./services/graphExplorerApi";
import type { EvidenceViewModel, GraphNodeViewModel, GraphRelationViewModel } from "./types/viewModels";

const graphExplorerApi = createHttpGraphExplorerApi(import.meta.env.VITE_GRAPH_API_BASE_URL ?? "");

export function App() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "financials">("overview");
  const deferredSearch = useDeferredValue(search);

  const explorer = useGraphExplorer(
    graphExplorerApi,
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
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeRelationId, setActiveRelationId] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceViewModel[]>([]);

  const activeNode = graph?.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activeRelation = graph?.relations.find((relation) => relation.id === activeRelationId) ?? graph?.relations[0] ?? null;

  useEffect(() => {
    let alive = true;

    async function hydrateRelationEvidence() {
      if (!activeRelation) {
        setActiveEvidence([]);
        return;
      }

      const evidence = await explorer.loadRelationEvidence(activeRelation);
      if (alive) {
        setActiveEvidence(evidence);
      }
    }

    void hydrateRelationEvidence();

    return () => {
      alive = false;
    };
  }, [activeRelation]);

  useEffect(() => {
    if (!graph) {
      return;
    }

    if (!explorer.loading && graph.focusCompany.id !== selectedCompanyId) {
      setSelectedCompanyId(graph.focusCompany.id);
    }

    if (!graph.nodes.some((node) => node.id === activeNodeId)) {
      setActiveNodeId(graph.focusCompany.id);
    }

    if (activeRelationId && !graph.relations.some((relation) => relation.id === activeRelationId)) {
      setActiveRelationId(graph.relations[0]?.id ?? null);
    }
  }, [activeNodeId, activeRelationId, explorer.loading, graph, selectedCompanyId]);

  function handleCompanySelect(companyId: string) {
    startTransition(() => {
      setSelectedCompanyId(companyId);
      setActiveNodeId(companyId);
      setActiveRelationId(null);
      setActiveTab("overview");
      setZoom(1);
    });
  }

  function handleNodeSelect(node: GraphNodeViewModel) {
    setActiveNodeId(node.id);
    const relation = graph?.relations.find((item) => item.sourceId === node.id || item.targetId === node.id) ?? null;
    setActiveRelationId(relation?.id ?? null);
    setActiveTab(relation ? "evidence" : "overview");
  }

  function handleRelationSelect(relation: GraphRelationViewModel) {
    setActiveRelationId(relation.id);
    setActiveNodeId(relation.targetId);
    setActiveTab("evidence");
  }

  if (!graph) {
    return <div className="loadingShell">{explorer.error ?? "Loading graph shell…"}</div>;
  }

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
          company={graph.focusCompany}
          evidence={activeEvidence}
          evidenceSummary={graph.evidenceOverview}
          onRelationSelect={handleRelationSelect}
          onTabChange={setActiveTab}
          relations={graph.relations}
        />
      </section>

      {explorer.loading ? <div className="loadingToast">Refreshing graph…</div> : null}
      {!explorer.loading && explorer.error ? <div className="loadingToast">{explorer.error}</div> : null}
    </main>
  );
}
