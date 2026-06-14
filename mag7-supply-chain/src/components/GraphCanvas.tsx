import { CornersOut, CursorClick, MapTrifold, Plus, Minus } from "@phosphor-icons/react";
import type { GraphNodeDTO, GraphRelationDTO, SubgraphDTO } from "../types/contracts";

interface GraphCanvasProps {
  activeNodeId: string;
  activeRelationId: string | null;
  graph: SubgraphDTO;
  onNodeSelect: (node: GraphNodeDTO) => void;
  onRelationSelect: (relation: GraphRelationDTO) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const relationLabels: Record<GraphRelationDTO["relationshipType"], string> = {
  component_supply: "Component",
  manufacturing: "Manufacturing",
  cloud_service: "Cloud / Compute",
  raw_material_supply: "Raw Material",
  equipment_supply: "Equipment",
  software_dependency: "Entry",
};

export function GraphCanvas(props: GraphCanvasProps) {
  const { activeNodeId, activeRelationId, graph, onNodeSelect, onRelationSelect, onZoomChange, zoom } = props;

  return (
    <section className="panel canvasPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Graph Canvas</p>
          <h2>{graph.company.name} supply chain view</h2>
        </div>
        <div className="panelActions">
          <button className="iconAction" type="button" onClick={() => onZoomChange(Math.max(0.8, zoom - 0.1))}>
            <Minus size={16} />
          </button>
          <button className="iconAction" type="button" onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}>
            <Plus size={16} />
          </button>
          <button className="ghostAction" type="button">
            <CornersOut size={16} />
            Fullscreen hook
          </button>
        </div>
      </div>

      <div className="canvasLegend">
        <span><MapTrifold size={15} /> World-map-backed container</span>
        <span><CursorClick size={15} /> Node and relation selection wired</span>
      </div>

      <div className="graphViewport">
        <div className="graphViewportOverlay" />
        <svg viewBox="0 0 100 100" role="img" aria-label={`${graph.company.name} supply chain graph`}>
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
                    {relationLabels[relation.relationshipType]}
                  </text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const radius = 2.4 + node.importanceScore * 2.6;
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
      </div>
    </section>
  );
}

function curvePath(source: GraphNodeDTO, target: GraphNodeDTO) {
  const controlX = (source.x + target.x) / 2;
  const controlY = Math.min(source.y, target.y) - Math.abs(source.x - target.x) * 0.12;
  return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}
