import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import type { GraphNodeViewModel, GraphRelationViewModel, GraphViewModel } from "../types/viewModels";
import { getRelationshipTypeLabel } from "../utils/relationSemantics";

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

  return (
    <section className="graphWorkspace">
      <div className="workspaceHeader">
        <div>
          <h3>Global Supply Chain Map</h3>
          <p>Relationship type and tier depth are encoded directly on the dark graph workspace.</p>
        </div>

        <div className="workspaceTopline">
          <div className="inlineLegend">
            <span>Relationship Type</span>
            <strong>Supply</strong>
            <strong>Manufacturing</strong>
            <strong>Logistics</strong>
            <strong>IP / Technology</strong>
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

      <div className="graphViewport">
        <div className="graphViewportOverlay" />
        <div className="graphDust" />
        <svg viewBox="0 0 100 100" role="img" aria-label={`${graph.focusCompany.name} supply chain graph`}>
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
          <button className="iconButton" type="button" onClick={() => onZoomChange(Math.max(0.8, zoom - 0.1))}>
            <Minus size={16} />
          </button>
          <button className="iconButton" type="button" onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}>
            <Plus size={16} />
          </button>
          <button className="iconButton" type="button">
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
          <strong>{focusNode.label}</strong>
          <span>{focusNode.secondaryLabel ?? focusNode.region}</span>
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
