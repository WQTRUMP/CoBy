import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { CompanySidebar } from "./components/CompanySidebar";
import { EvidencePanel } from "./components/EvidencePanel";
import { GraphCanvas } from "./components/GraphCanvas";
import { RelationsPanel } from "./components/RelationsPanel";
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
      setZoom(1);
    });
  }

  function handleNodeSelect(node: GraphNodeDTO) {
    setActiveNodeId(node.id);
    const relation = graph?.relations.find((item) => item.sourceId === node.id || item.targetId === node.id) ?? null;
    setActiveRelationId(relation?.id ?? null);
  }

  function handleRelationSelect(relation: GraphRelationDTO) {
    setActiveRelationId(relation.id);
    setActiveNodeId(relation.targetId);
  }

  if (!graph) {
    return <div className="loadingShell">Loading graph shell…</div>;
  }

  return (
    <main className="appShell">
      <TopBar
        companies={explorer.companies}
        depth={depth}
        onCompanySelect={handleCompanySelect}
        onDepthChange={setDepth}
        onSearchChange={setSearch}
        search={search}
        selectedCompanyId={selectedCompanyId}
      />

      <StatusStrip graph={graph} />

      <section className="workspace">
        <CompanySidebar activeNode={activeNode} company={graph.company} />
        <GraphCanvas
          activeNodeId={activeNodeId}
          activeRelationId={activeRelation?.id ?? null}
          graph={graph}
          onNodeSelect={handleNodeSelect}
          onRelationSelect={handleRelationSelect}
          onZoomChange={setZoom}
          zoom={zoom}
        />
        <div className="rightRail">
          <RelationsPanel onSelect={handleRelationSelect} relations={graph.relations} selectedRelationId={activeRelation?.id ?? null} />
          <EvidencePanel evidence={activeEvidence} relation={activeRelation} />
        </div>
      </section>

      {explorer.loading ? <div className="loadingToast">Refreshing graph…</div> : null}
    </main>
  );
}
