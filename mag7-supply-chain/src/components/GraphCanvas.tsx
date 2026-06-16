import { ArrowsOutSimple, GearSix, Minus, Plus } from "@phosphor-icons/react";
import { useId } from "react";
import type { GraphNodeViewModel, GraphRelationViewModel, GraphViewModel } from "../types/viewModels";
import { getRelationshipTypeLabel } from "../utils/relationSemantics.js";

interface GraphCanvasProps {
  activeNodeId: string | null;
  activeRelationId: string | null;
  depth?: number;
  focusNode: GraphNodeViewModel;
  graph: GraphViewModel;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  onNodeSelect: (node: GraphNodeViewModel) => void;
  onRelationSelect: (relation: GraphRelationViewModel) => void;
  onZoomChange: (zoom: number) => void;
  zoom: number;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const {
    activeNodeId,
    activeRelationId,
    depth = 3,
    focusNode,
    graph,
    isFullscreen = false,
    onFullscreenToggle = () => undefined,
    onNodeSelect,
    onRelationSelect,
    onZoomChange,
    zoom,
  } = props;
  const instructionsId = useId();
  const visibleNodes = graph.nodes.length;
  const visibleRelations = graph.relations.length;
  const expansionHint = graph.relations.find((relation) => relation.confidence === "strong_evidence") ?? graph.relations[0] ?? null;

  return (
    <section className="graphWorkspace">
      <div className="graphViewport" aria-describedby={instructionsId}>
        <div className="graphViewportTextures" aria-hidden="true" />

        <div className="graphStatsCluster">
          <div className="graphStatCard">
            <span>可视节点</span>
            <strong>{visibleNodes}</strong>
          </div>
          <div className="graphStatCard">
            <span>关系</span>
            <strong>{visibleRelations}</strong>
          </div>
        </div>

        <div className="graphCanvasControls">
          <button aria-label="图谱设置" className="graphControlButton" type="button">
            <GearSix size={16} />
          </button>
          <button
            aria-label="缩小图谱"
            className="graphControlButton"
            onClick={() => onZoomChange(Math.max(0.82, zoom - 0.1))}
            type="button"
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="放大图谱"
            className="graphControlButton"
            onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}
            type="button"
          >
            <Plus size={16} />
          </button>
          <button
            aria-label={isFullscreen ? "退出全屏探索" : "进入全屏探索"}
            aria-pressed={isFullscreen}
            className="graphControlButton"
            onClick={onFullscreenToggle}
            type="button"
          >
            <ArrowsOutSimple size={16} />
          </button>
        </div>

        <div className="graphExpansionHint">{expansionHint ? `展开中... ${expansionHint.summary}` : "展开中..."}</div>
        <div className="graphLegendCopy">
          Nodes distinguish group anchors, brand/legal naming, and facility operators instead of flattening all aliases into one
          surface.
        </div>

        <p className="srOnly" id={instructionsId}>
          使用图谱内的节点与关系按钮进行探索。选择节点可刷新概览，选择关系可打开证据与审计信息。
        </p>

        <svg aria-hidden="true" focusable="false" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="focusGlow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="rgba(255,107,87,0.95)" />
              <stop offset="55%" stopColor="rgba(255,107,87,0.18)" />
              <stop offset="100%" stopColor="rgba(255,107,87,0)" />
            </radialGradient>
          </defs>

          <g transform={`scale(${zoom}) translate(${(1 - zoom) * 50} ${(1 - zoom) * 50})`}>
            {graph.relations.map((relation) => {
              const source = graph.nodes.find((node) => node.id === relation.sourceId);
              const target = graph.nodes.find((node) => node.id === relation.targetId);
              if (!source || !target) {
                return null;
              }

              const isActive = relation.id === activeRelationId;
              const isDimmed = !isActive && activeRelationId !== null;
              return (
                <g key={relation.id}>
                  <path
                    className={isActive ? "graphEdge active" : isDimmed ? "graphEdge dimmed" : "graphEdge"}
                    d={curvePath(source, target)}
                    onClick={() => onRelationSelect(relation)}
                    style={{ ["--edge-color" as string]: getEdgeColor(relation.relationshipType) }}
                  />
                  <text className="graphEdgeLabel" x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 1.2}>
                    {getRelationshipTypeLabel(relation.relationshipType)}
                  </text>
                </g>
              );
            })}

            {graph.nodes.map((node) => {
              const radius = getNodeRadius(node);
              const isActive = node.id === activeNodeId;
              const isFocus = node.id === focusNode.id;
              return (
                <g
                  className={isActive ? "graphNode active" : isFocus ? "graphNode focus" : "graphNode"}
                  key={node.id}
                  onClick={() => onNodeSelect(node)}
                  transform={`translate(${node.x} ${node.y})`}
                >
                  {isFocus ? <circle className="graphNodeGlow" r={radius + 4.6} /> : null}
                  <circle
                    className="graphNodeRing"
                    r={radius + 1.2}
                    style={{ ["--ring-color" as string]: getTierColor(node, depth) }}
                  />
                  <circle className="graphNodeCore" r={radius} style={{ ["--node-fill" as string]: getNodeFill(node, isFocus) }} />
                  <text y={radius + 4.2}>{node.label}</text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="collapsedClusterBadge">
          <span>已折叠</span>
          <strong>18 个节点</strong>
        </div>

        <div className="miniMapCard">
          <div className="miniMapCardHeader">
            <strong>全局缩略图</strong>
            <span>{graph.focusCompany.displayName}</span>
          </div>
          <div className="miniMapFrame">
            {graph.nodes.slice(0, 28).map((node) => (
              <i key={node.id} style={{ left: `${node.x}%`, top: `${node.y}%` }} />
            ))}
          </div>
        </div>

        <div className="graphKeyboardDock">
          <div className="graphKeyboardPanel">
            <div className="graphKeyboardHeader">
              <strong>节点快捷列表</strong>
              <span>{graph.nodes.length}</span>
            </div>
            <div className="graphKeyboardList">
              {graph.nodes.slice(0, 10).map((node) => {
                const isActive = node.id === activeNodeId;
                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? "graphListButton active" : "graphListButton"}
                    key={node.id}
                    onClick={() => onNodeSelect(node)}
                    type="button"
                  >
                    <span>{node.kindLabel}</span>
                    <strong>{node.displayName}</strong>
                    <small>{node.secondaryLabel || node.region}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="graphKeyboardPanel relationPanel">
            <div className="graphKeyboardHeader">
              <strong>关系路径</strong>
              <span>{graph.relations.length}</span>
            </div>
            <div className="graphKeyboardList">
              {graph.relations.slice(0, 8).map((relation) => {
                const isActive = relation.id === activeRelationId;
                return (
                  <button
                    aria-pressed={isActive}
                    className={isActive ? "graphListButton active" : "graphListButton"}
                    key={relation.id}
                    onClick={() => onRelationSelect(relation)}
                    type="button"
                  >
                    <span>
                      {relation.relationshipTypeLabel} / {relation.tier}级
                    </span>
                    <strong>{relation.summary}</strong>
                    <small>{relation.relationshipSubtypeLabel ?? relation.relationshipSemanticLabel}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="focusBreadcrumb">焦点路径: {graph.focusCompany.displayName} → 供应链网络 → 全球视图 ({depth}级穿透)</div>
      </div>
    </section>
  );
}

function curvePath(source: GraphNodeViewModel, target: GraphNodeViewModel) {
  const controlX = (source.x + target.x) / 2;
  const controlY = Math.min(source.y, target.y) - Math.abs(source.x - target.x) * 0.12;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}

function getNodeRadius(node: GraphNodeViewModel) {
  if (node.marketCapUsd && node.marketCapUsd >= 1_000_000_000_000) return 6.2;
  if (node.marketCapUsd && node.marketCapUsd >= 100_000_000_000) return 5.1;
  if (node.marketCapUsd && node.marketCapUsd >= 50_000_000_000) return 4.3;
  if (node.marketCapUsd && node.marketCapUsd >= 10_000_000_000) return 3.5;
  return node.kind === "company" ? 2.9 + node.importanceScore * 1.4 : 1.8 + node.importanceScore * 1.7;
}

function getNodeFill(node: GraphNodeViewModel, isFocus: boolean) {
  if (isFocus) return "#ff6b57";
  if (node.kind === "company") return "#67e8f9";
  if (node.kind === "material") return "#f4b740";
  return "#8ba3b8";
}

function getTierColor(node: GraphNodeViewModel, depth: number) {
  if (node.isAnchor) return "#ff6b57";
  if (depth === 1) return "#67e8f9";
  if (depth === 2) return "#73a8ff";
  if (depth === 3) return "#f4b740";
  return "#8ba3b8";
}

function getEdgeColor(value: GraphRelationViewModel["relationshipType"]) {
  switch (value) {
    case "component_supply":
      return "#67e8f9";
    case "manufacturing":
      return "#f4b740";
    case "raw_material_supply":
      return "#ffd46a";
    case "cloud_service":
      return "#6ee7a8";
    case "logistics":
      return "#77b2ff";
    case "professional_service":
      return "#8ba3b8";
    default:
      return "#67e8f9";
  }
}
