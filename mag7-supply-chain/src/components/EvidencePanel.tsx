import { FileText, LinkSimple, ShieldCheck } from "@phosphor-icons/react";
import type { EvidenceDTO, GraphRelationDTO } from "../types/contracts";

interface EvidencePanelProps {
  evidence: EvidenceDTO[];
  relation: GraphRelationDTO | null;
}

export function EvidencePanel({ evidence, relation }: EvidencePanelProps) {
  return (
    <div className="evidenceTabPanel">
      <div className="detailCard">
        <div>
          <p className="sectionEyebrow compact">Evidence</p>
          <strong>{relation ? "Relation-scoped source cards" : "Evidence placeholder"}</strong>
        </div>
        <p>{relation ? relation.summary : "Select a relation to inspect citations and confidence labels."}</p>
      </div>

      <div className="evidenceList">
        {evidence.map((item) => (
          <article className="evidenceCard" key={item.id}>
            <div className="relationMeta">
              <span className="miniBadge">
                <FileText size={12} /> {item.sourceType}
              </span>
              <span className={`confidenceBadge ${item.confidence}`}>
                <ShieldCheck size={12} /> {formatConfidence(item.confidence)}
              </span>
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

      <div className="detailCard provenanceCard">
        <p className="sectionEyebrow compact">Evidence provenance</p>
        <div className="provenanceGrid">
          <span>Document</span>
          <strong>{evidence[0]?.sourceType ?? "10-K / Report"}</strong>
          <span>Filed date</span>
          <strong>{evidence[0]?.publishedAt ?? "Pending source binding"}</strong>
          <span>Issuer</span>
          <strong>{evidence[0]?.publisher ?? "Company / publisher"}</strong>
          <span>Access</span>
          <strong>{evidence[0]?.url ? "External source ready" : "Connector pending"}</strong>
        </div>
      </div>
    </div>
  );
}

function formatConfidence(value: EvidenceDTO["confidence"]) {
  if (value === "strong_evidence") return "Strong evidence";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
