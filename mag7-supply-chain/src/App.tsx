import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CompanySidebar } from "./components/CompanySidebar";
import { GraphCanvas } from "./components/GraphCanvas";
import { StatusStrip } from "./components/StatusStrip";
import { TopBar } from "./components/TopBar";
import { useGraphExplorer } from "./hooks/useGraphExplorer";
import { ApiRequestError, createHttpGraphExplorerApi } from "./services/graphExplorerApi";
import type { EvidenceViewModel, GraphNodeViewModel, GraphRelationViewModel } from "./types/viewModels";

const graphExplorerApi = createHttpGraphExplorerApi(import.meta.env.VITE_GRAPH_API_BASE_URL ?? "");

export function App() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "financials">("overview");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [relationshipTypes, setRelationshipTypes] = useState<GraphRelationViewModel["relationshipType"][]>([]);
  const [relationshipSubtype, setRelationshipSubtype] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const explorer = useGraphExplorer(
    graphExplorerApi,
    useMemo(
      () => ({
        companyId: selectedCompanyId,
        depth,
        search: deferredSearch,
        relationshipTypes,
        relationshipSubtype,
      }),
      [deferredSearch, depth, relationshipSubtype, relationshipTypes, selectedCompanyId],
    ),
  );

  const graph = explorer.graph;
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeRelationId, setActiveRelationId] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceViewModel[]>([]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const activeNode = graph?.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activeRelation = graph?.relations.find((relation) => relation.id === activeRelationId) ?? graph?.relations[0] ?? null;

  useEffect(() => {
    let alive = true;

    async function hydrateRelationEvidence() {
      if (!activeRelation) {
        setActiveEvidence([]);
        setEvidenceError(null);
        setEvidenceLoading(false);
        return;
      }

      setEvidenceLoading(true);
      setEvidenceError(null);

      try {
        const evidence = await explorer.loadRelationEvidence(activeRelation);
        if (alive) {
          setActiveEvidence(evidence);
        }
      } catch (error) {
        if (alive) {
          setActiveEvidence([]);
          setEvidenceError(getEvidenceErrorMessage(error));
        }
      } finally {
        if (alive) {
          setEvidenceLoading(false);
        }
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

  useEffect(() => {
    if (!graph || !relationshipSubtype) {
      return;
    }

    const stillAvailable = graph.relationshipSubtypeOptions.some((option) => option.value === relationshipSubtype);
    if (!stillAvailable) {
      setRelationshipSubtype(null);
    }
  }, [graph, relationshipSubtype]);

  function handleCompanySelect(companyId: string) {
    captureFocusTrigger();
    startTransition(() => {
      setSelectedCompanyId(companyId);
      setActiveNodeId(companyId);
      setActiveRelationId(null);
      setActiveTab("overview");
      setSidebarOpen(true);
      setZoom(1);
    });
  }

  function handleNodeSelect(node: GraphNodeViewModel) {
    captureFocusTrigger();
    setActiveNodeId(node.id);
    const relation = graph?.relations.find((item) => item.sourceId === node.id || item.targetId === node.id) ?? null;
    setActiveRelationId(relation?.id ?? null);
    setActiveTab(relation ? "evidence" : "overview");
    setSidebarOpen(true);
  }

  function handleRelationSelect(relation: GraphRelationViewModel) {
    captureFocusTrigger();
    setActiveRelationId(relation.id);
    setActiveNodeId(relation.targetId);
    setActiveTab("evidence");
    setSidebarOpen(true);
  }

  function handleRelationshipTypeToggle(value: GraphRelationViewModel["relationshipType"]) {
    setRelationshipTypes((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function handleFilterClear() {
    setRelationshipTypes([]);
    setRelationshipSubtype(null);
  }

  function handleSidebarClose() {
    setSidebarOpen(false);
    lastTriggerRef.current?.focus();
  }

  function handleRetry() {
    explorer.reload();
  }

  function handleRetryEvidence() {
    if (!activeRelation) {
      return;
    }

    void explorer.loadRelationEvidence(activeRelation)
      .then((evidence) => {
        setActiveEvidence(evidence);
        setEvidenceError(null);
      })
      .catch((error) => {
        setEvidenceError(getEvidenceErrorMessage(error));
      })
      .finally(() => {
        setEvidenceLoading(false);
      });
    setEvidenceLoading(true);
  }

  function captureFocusTrigger() {
    if (document.activeElement instanceof HTMLElement) {
      lastTriggerRef.current = document.activeElement;
    }
  }

  if (!graph) {
    if (explorer.error) {
      return (
        <main className="loadingShell">
          <div className="loadingStateCard" role="alert">
            <strong>Graph explorer unavailable</strong>
            <p>{explorer.error}</p>
            <button className="inlineActionButton" onClick={handleRetry} type="button">
              Retry graph load
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="loadingShell">
        <div className="loadingStateCard" role="status" aria-live="polite">
          <strong>Loading graph shell…</strong>
          <p>Preparing the published Mag7 graph view and company list.</p>
        </div>
      </main>
    );
  }

  const focusNode = activeNode ?? graph.nodes[0];

  return (
    <main className="atlasPage">
      <TopBar
        companies={explorer.companies}
        depth={depth}
        filtersOpen={filtersOpen}
        graph={graph}
        onCompanySelect={handleCompanySelect}
        onDepthChange={setDepth}
        onFiltersClear={handleFilterClear}
        onFiltersToggle={() => setFiltersOpen((current) => !current)}
        onSearchChange={setSearch}
        onRelationshipSubtypeChange={setRelationshipSubtype}
        onRelationshipTypeToggle={handleRelationshipTypeToggle}
        relationshipSubtype={relationshipSubtype}
        relationshipSubtypeOptions={graph.relationshipSubtypeOptions}
        relationshipTypes={relationshipTypes}
        relationTypeOptions={graph.relationTypeOptions}
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

        {sidebarOpen ? (
          <CompanySidebar
            activeNode={activeNode}
            activeRelation={activeRelation}
            activeTab={activeTab}
            company={graph.focusCompany}
            evidence={activeEvidence}
            evidenceError={evidenceError}
            evidenceLoading={evidenceLoading}
            evidenceSummary={graph.evidenceOverview}
            isOpen={sidebarOpen}
            onClose={handleSidebarClose}
            onRelationSelect={handleRelationSelect}
            onRetryEvidence={handleRetryEvidence}
            onTabChange={setActiveTab}
            relations={graph.relations}
          />
        ) : null}
      </section>

      {explorer.loading ? (
        <div className="loadingToast" role="status" aria-live="polite">
          Refreshing graph…
        </div>
      ) : null}
      {!explorer.loading && explorer.error ? (
        <div className="loadingToast error" role="alert">
          <span>{explorer.error}</span>
          <button className="inlineActionButton toast" onClick={handleRetry} type="button">
            Retry
          </button>
        </div>
      ) : null}
    </main>
  );
}

function getEvidenceErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 404) {
    return "Evidence is not available for this relation in the published view yet. Candidate-only evidence remains outside the published release boundary.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load relation evidence.";
}
