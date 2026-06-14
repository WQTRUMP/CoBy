import { ArrowsInCardinal, Path, Sparkle } from "@phosphor-icons/react";
import type { GraphRelationDTO } from "../types/contracts";

interface RelationsPanelProps {
  relations: GraphRelationDTO[];
  selectedRelationId: string | null;
  onSelect: (relation: GraphRelationDTO) => void;
}

export function RelationsPanel({ onSelect, relations, selectedRelationId }: RelationsPanelProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Relations</p>
          <h2>Selected subgraph edges</h2>
        </div>
        <span className="miniBadge">{relations.length} items</span>
      </div>

      <div className="stackList">
        {relations.map((relation) => (
          <button
            key={relation.id}
            className={relation.id === selectedRelationId ? "relationCard active" : "relationCard"}
            onClick={() => onSelect(relation)}
            type="button"
          >
            <div className="relationMeta">
              <span className="miniBadge"><Path size={12} /> Tier {relation.tier}</span>
              <span className={`confidenceBadge ${relation.confidence}`}>{relation.confidence}</span>
            </div>
            <strong>{relation.summary}</strong>
            <div className="relationFooter">
              <span><ArrowsInCardinal size={12} /> {relation.relationshipType}</span>
              <span><Sparkle size={12} /> {Math.round(relation.confidenceScore * 100)} score</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
