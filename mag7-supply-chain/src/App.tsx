import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CompanySidebar } from "./components/CompanySidebar";
import { ExplorerCommandRail } from "./components/ExplorerCommandRail";
import { GraphCanvas } from "./components/GraphCanvas";
import { MobileEvidenceSheet } from "./components/MobileEvidenceSheet";
import { StatusStrip } from "./components/StatusStrip";
import { TopBar } from "./components/TopBar";
import { useGraphExplorer } from "./hooks/useGraphExplorer";
import { ApiRequestError, createHttpGraphExplorerApi } from "./services/graphExplorerApi";
import type { EvidenceViewModel, GraphNodeViewModel, GraphRelationViewModel } from "./types/viewModels";

const graphExplorerApi = createHttpGraphExplorerApi(import.meta.env.VITE_GRAPH_API_BASE_URL ?? "");

export function App() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [depth, setDepth] = useState(3);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "financials">("evidence");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [relationshipTypes, setRelationshipTypes] = useState<GraphRelationViewModel["relationshipType"][]>([]);
  const [relationshipSubtype, setRelationshipSubtype] = useState<string | null>(null);
  const [isExplorerFullscreen, setIsExplorerFullscreen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const explorerShellRef = useRef<HTMLDivElement | null>(null);

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
    function handleFullscreenChange() {
      setIsExplorerFullscreen(document.fullscreenElement === explorerShellRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
  }, [activeRelation, explorer]);

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

  async function handleFullscreenToggle() {
    if (!explorerShellRef.current) {
      return;
    }

    if (document.fullscreenElement === explorerShellRef.current) {
      await document.exitFullscreen();
      return;
    }

    await explorerShellRef.current.requestFullscreen();
  }

  function handleCompanySelect(companyId: string) {
    captureFocusTrigger();
    startTransition(() => {
      setSelectedCompanyId(companyId);
      setActiveNodeId(companyId);
      setActiveRelationId(null);
      setActiveTab("evidence");
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

    void explorer
      .loadRelationEvidence(activeRelation)
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
            <strong>图谱探索器暂不可用</strong>
            <p>{explorer.error}</p>
            <button className="inlineActionButton" onClick={handleRetry} type="button">
              重试加载
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="loadingShell">
        <div className="loadingStateCard" role="status" aria-live="polite">
          <strong>正在准备探索壳层...</strong>
          <p>加载已发布 Mag7 图谱、公司列表与证据视图。</p>
        </div>
      </main>
    );
  }

  const focusNode = activeNode ?? graph.nodes[0];
  const visibleRegions = new Set(graph.nodes.map((node) => node.region)).size;
  const selectedCompanyOption =
    explorer.companies.find((company) => company.id === selectedCompanyId) ??
    explorer.companies.find((company) => company.id === graph.focusCompany.id) ??
    graph.focusCompany;

  return (
    <main className="explorerPage">
      <section className="annotationRow" aria-label="核心交互说明">
        <article className="annotationCard">
          <span className="annotationIndex">1</span>
          <div>
            <strong>节点展开 / 收缩</strong>
            <p>点击图谱节点或关系入口，保持图谱为主视图并在右侧刷新证据层。</p>
          </div>
        </article>
        <article className="annotationCard">
          <span className="annotationIndex">2</span>
          <div>
            <strong>搜索定位</strong>
            <p>顶部搜索与左侧结果联动，选择公司后重置焦点、层级与证据上下文。</p>
          </div>
        </article>
        <article className="annotationCard">
          <span className="annotationIndex">3</span>
          <div>
            <strong>证据审计侧栏</strong>
            <p>桌面端以覆盖层滑入，不挤压图谱；移动端降级为底部证据抽屉。</p>
          </div>
        </article>
        <article className="annotationCard">
          <span className="annotationIndex">4</span>
          <div>
            <strong>响应式证据流</strong>
            <p>保留概览 / 证据 / 财务三标签与审计信息区，确保一套数据契约多端复用。</p>
          </div>
        </article>
      </section>

      <section className={isExplorerFullscreen ? "explorerShell fullscreen" : "explorerShell"} ref={explorerShellRef}>
        <TopBar
          depth={depth}
          evidenceSummary={graph.evidenceOverview}
          graph={graph}
          isFullscreen={isExplorerFullscreen}
          onDepthChange={setDepth}
          onFiltersClear={handleFilterClear}
          onFullscreenToggle={() => {
            void handleFullscreenToggle();
          }}
          onRelationshipSubtypeChange={setRelationshipSubtype}
          onRelationshipTypeToggle={handleRelationshipTypeToggle}
          onSearchChange={setSearch}
          relationshipSubtype={relationshipSubtype}
          relationshipSubtypeOptions={graph.relationshipSubtypeOptions}
          relationshipTypes={relationshipTypes}
          relationTypeOptions={graph.relationTypeOptions}
          search={search}
        />

        <div className="explorerWorkspace">
          <ExplorerCommandRail
            activeCompanyId={selectedCompanyOption.id}
            coveredRegions={visibleRegions}
            focusCompany={graph.focusCompany}
            onCompanySelect={handleCompanySelect}
            search={search}
            searchResults={explorer.companies}
            tier1SupplierCount={graph.focusCompany.overview.tier1SupplierCount}
          />

          <div className="graphStage">
            <GraphCanvas
              activeNodeId={activeNodeId}
              activeRelationId={activeRelation?.id ?? null}
              depth={depth}
              focusNode={focusNode}
              graph={graph}
              isFullscreen={isExplorerFullscreen}
              onFullscreenToggle={() => {
                void handleFullscreenToggle();
              }}
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
                depth={depth}
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
          </div>
        </div>

        <StatusStrip graph={graph} />
      </section>

      <MobileEvidenceSheet
        activeRelation={activeRelation}
        activeTab={activeTab}
        company={graph.focusCompany}
        depth={depth}
        evidence={activeEvidence}
        evidenceError={evidenceError}
        evidenceLoading={evidenceLoading}
        evidenceSummary={graph.evidenceOverview}
        onRetryEvidence={handleRetryEvidence}
        onTabChange={setActiveTab}
      />

      {explorer.loading ? (
        <div className="loadingToast" role="status" aria-live="polite">
          正在刷新图谱...
        </div>
      ) : null}
      {!explorer.loading && explorer.error ? (
        <div className="loadingToast error" role="alert">
          <span>{explorer.error}</span>
          <button className="inlineActionButton toast" onClick={handleRetry} type="button">
            重试
          </button>
        </div>
      ) : null}
    </main>
  );
}

function getEvidenceErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 404) {
    return "该关系尚未发布可展示证据。候选证据仍保留在当前发布边界之外。";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "加载关系证据失败。";
}
