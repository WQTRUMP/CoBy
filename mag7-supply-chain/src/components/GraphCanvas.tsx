import { useEffect, useId, useRef, useState } from "react";
import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import type { GraphNodeViewModel, GraphRelationViewModel, GraphViewModel } from "../types/viewModels";
import { getRelationshipTypeLabel } from "../utils/relationSemantics.js";

interface GraphCanvasProps {
  activeNodeId: string | null;
  activeRelationId: string | null;
  focusNode: GraphNodeViewModel;
  graph: GraphViewModel;
  onNodeSelect: (node: GraphNodeViewModel) => void;
  onRelationSelect: (relation: GraphRelationViewModel) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
  const { activeNodeId, activeRelationId, focusNode, graph, onNodeSelect, onRelationSelect, onZoomChange, zoom } = props;
  const viewportId = useId();
  const instructionsId = useId();
  const nodesHeadingId = useId();
  const relationsHeadingId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === viewportRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function handleFullscreenToggle() {
    if (!viewportRef.current) {
      return;
    }

    if (document.fullscreenElement === viewportRef.current) {
      await document.exitFullscreen();
      return;
    }

    await viewportRef.current.requestFullscreen();
  }

  return (
    <section className="graphWorkspace">
      <div className="workspaceHeader">
        <div>
          <h3>Global Supply Chain Map</h3>
          <p>Relationship type and tier depth are encoded directly on the dark graph workspace.</p>
          <p>Nodes distinguish group anchors, brand/legal naming, and facility operators instead of flattening all aliases into one surface.</p>
        </div>

        <div className="workspaceTopline">
          <div className="inlineLegend">
            <span>Relationship Type</span>
            {graph.relationTypeOptions.map((option) => (
              <strong key={option.value}>
                {option.label}
                <small>{option.count}</small>
              </strong>
            ))}
          </div>
          <div className="inlineLegend">
            <span>Tier Depth</span>
            <strong>1</strong>
            <strong>2</strong>
            <strong>3</strong>
            <strong>4+</strong>
          </div>
        </div>
      </div>

      <div className="graphViewport" ref={viewportRef} id={viewportId}>
        <div className="graphViewportOverlay" />
        <div className="graphDust" />
        <div className="graphAssistivePanel" aria-describedby={instructionsId}>
          <div className="graphAssistiveHeader">
            <strong>Keyboard exploration</strong>
            <p id={instructionsId}>
              Use the node and relation buttons to inspect the currently visible graph. Selecting a node opens overview details;
              selecting a relation opens the evidence path.
            </p>
          </div>

          <div className="graphAssistiveSection" aria-labelledby={nodesHeadingId}>
            <div className="graphAssistiveSectionHeader">
              <strong id={nodesHeadingId}>Visible nodes</strong>
              <span>{graph.nodes.length} items</span>
            </div>
            <div className="graphAssistiveList">
              {graph.nodes.map((node) => {
                const isActive = node.id === activeNodeId;
                return (
                  <button
                    key={node.id}
                    aria-pressed={isActive}
                    className={isActive ? "graphListButton active" : "graphListButton"}
                    onClick={() => onNodeSelect(node)}
                    type="button"
                  >
                    <span className="graphListMeta">{node.kindLabel}</span>
                    <strong>{node.displayName}</strong>
                    <small>{node.secondaryLabel ?? node.region}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="graphAssistiveSection" aria-labelledby={relationsHeadingId}>
            <div className="graphAssistiveSectionHeader">
              <strong id={relationsHeadingId}>Visible relations</strong>
              <span>{graph.relations.length} items</span>
            </div>
            <div className="graphAssistiveList">
              {graph.relations.map((relation) => {
                const source = graph.nodes.find((node) => node.id === relation.sourceId);
                const target = graph.nodes.find((node) => node.id === relation.targetId);
                const isActive = relation.id === activeRelationId;
                const sourceName = source?.displayName ?? relation.sourceId;
                const targetName = target?.displayName ?? relation.targetId;
                return (
                  <button
                    key={relation.id}
                    aria-pressed={isActive}
                    className={isActive ? "graphListButton active" : "graphListButton"}
                    onClick={() => onRelationSelect(relation)}
                    type="button"
                  >
                    <span className="graphListMeta">
                      {relation.relationshipTypeLabel} · Tier {relation.tier}
                    </span>
                    <strong>{relation.summary}</strong>
                    <small>
                      {sourceName} to {targetName}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <g transform={`scale(${zoom}) translate(${(1 - zoom) * 50} ${(1 - zoom) * 50})`}>
            {graph.relations.map((relation) => {
              const source = graph.nodes.find((node) => node.id === relation.sourceId);
              const target = graph.nodes.find((node) => node.id === relation.targetId);
              if (!source || !target) return null;

              const isActive = relation.id === activeRelationId;
              return (
                <g key={relation.id}>
                  <path
                    className={isActive ? "graphEdge active" : "graphEdge"}
                    d={curvePath(source, target)}
                    onClick={() => onRelationSelect(relation)}
                  />
                  <text className="graphEdgeLabel" x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 2}>
                    {getRelationshipTypeLabel(relation.relationshipType)}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const radius = node.kind === "company" ? 5.8 + node.importanceScore * 2.2 : 1.8 + node.importanceScore * 2.8;
              return (
                <g
                  key={node.id}
                  className={node.id === activeNodeId ? "graphNode active" : "graphNode"}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={() => onNodeSelect(node)}
                >
                  <circle r={radius} />
                  <text y={radius + 4.2}>{node.label}</text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="miniMapPlaceholder">
          <div className="miniMapHeader">Mini-map</div>
          <div className="miniMapFrame" />
        </div>

        <div className="zoomCluster">
          <button
            aria-label="Zoom out graph"
            className="iconButton"
            type="button"
            onClick={() => onZoomChange(Math.max(0.8, zoom - 0.1))}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Zoom in graph"
            className="iconButton"
            type="button"
            onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label={isFullscreen ? "Exit fullscreen exploration" : "Enter fullscreen exploration"}
            aria-pressed={isFullscreen}
            className="iconButton"
            type="button"
            onClick={() => {
              void handleFullscreenToggle();
            }}
          >
            <CornersOut size={16} />
          </button>
        </div>

        <div className="marketLegend">
          <span>Market importance by market cap (USD)</span>
          <div className="marketLegendDots">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="focusPill">
          <strong>{focusNode.displayName}</strong>
          <span>{focusNode.secondaryLabel ?? focusNode.region}</span>
          <small>{focusNode.hierarchySummary}</small>
        </div>
      </div>
    </section>
  );
}

function curvePath(source: GraphNodeViewModel, target: GraphNodeViewModel) {
  const controlX = (source.x + target.x) / 2;
  const controlY = Math.min(source.y, target.y) - Math.abs(source.x - target.x) * 0.12;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}
