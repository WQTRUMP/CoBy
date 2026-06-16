import { ArrowsInCardinal, Path, Sparkle } from "@phosphor-icons/react";
import type { GraphRelationViewModel } from "../types/viewModels";

interface RelationsPanelProps {
  relations: GraphRelationViewModel[];
  selectedRelationId: string | null;
  onSelect: (relation: GraphRelationViewModel) => void;
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
              <span className={`miniBadge skuGranularityBadge ${getSkuGranularityClassName(relation.skuGranularityValue)}`}>
                {relation.skuGranularityLabel}
              </span>
            </div>
            <strong>{relation.summary}</strong>
            <p className="supportingText">
              粒度来源：{relation.skuGranularitySourceLabel ?? "未标注"}
              {relation.skuGranularityIsBackfilled ? " · 已回填" : ""}
            </p>
            {relation.skuGranularityBoundaryHint ? <p className="boundaryHint">{relation.skuGranularityBoundaryHint}</p> : null}
            {relation.skuGranularityNote ? <p className="supportingText">{relation.skuGranularityNote}</p> : null}
            <div className="relationFooter">
              <span><ArrowsInCardinal size={12} /> {relation.relationshipTypeLabel}</span>
              <span><Sparkle size={12} /> {Math.round(relation.confidenceScore * 100)} score</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function getSkuGranularityClassName(value: GraphRelationViewModel["skuGranularityValue"]) {
  return value ? `skuGranularity-${value}` : "skuGranularity-unknown";
}
