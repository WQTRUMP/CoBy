import { FileText, LinkSimple, ShieldCheck } from "@phosphor-icons/react";
import type { EvidenceDTO, GraphRelationDTO } from "../types/contracts";

interface EvidencePanelProps {
  evidence: EvidenceDTO[];
  relation: GraphRelationDTO | null;
}

export function EvidencePanel({ evidence, relation }: EvidencePanelProps) {
  return (
    <section className="panel evidencePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Evidence Panel</p>
          <h2>{relation ? "Relation-scoped source cards" : "Evidence placeholder"}</h2>
        </div>
        <span className="miniBadge">{evidence.length} cards</span>
      </div>

      {relation ? <p className="summaryText">{relation.summary}</p> : <p className="summaryText">Select a relation to inspect citations and confidence labels.</p>}

      <div className="stackList">
        {evidence.map((item) => (
          <article className="evidenceCard" key={item.id}>
            <div className="relationMeta">
              <span className="miniBadge"><FileText size={12} /> {item.sourceType}</span>
              <span className={`confidenceBadge ${item.confidence}`}><ShieldCheck size={12} /> {item.confidence}</span>
            </div>
            <strong>{item.title}</strong>
            <p>{item.citation}</p>
            <div className="evidenceFooter">
              <span>{item.publisher}</span>
              <span>{item.publishedAt}</span>
            </div>
            <a href={item.url} target="_blank" rel="noreferrer">
              <LinkSimple size={14} />
              Open source
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
