import type { ReactNode } from "react";
import { Buildings, ChartBar, Database, LinkBreak, Path, Stack } from "@phosphor-icons/react";
import { EvidencePanel } from "./EvidencePanel";
import type { CompanyDetail, EvidenceDTO, GraphNodeDTO, GraphRelationDTO } from "../types/contracts";
import { graphApiContract } from "../services/graphExplorerApi";

interface CompanySidebarProps {
  activeNode: GraphNodeDTO | null;
  activeRelation: GraphRelationDTO | null;
  activeTab: "overview" | "evidence" | "financials";
  company: CompanyDetail;
  evidence: EvidenceDTO[];
  evidenceSummary: {
    confirmed: number;
    strongEvidence: number;
    inferred: number;
  };
  onRelationSelect: (relation: GraphRelationDTO) => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
  relations: GraphRelationDTO[];
}

export function CompanySidebar(props: CompanySidebarProps) {
  const { activeNode, activeRelation, activeTab, company, evidence, evidenceSummary, onRelationSelect, onTabChange, relations } = props;

  return (
    <aside className="detailSidebar">
      <div className="detailSidebarHeader">
        <div className="detailCompany">
          <div className="detailLogo">{company.ticker.slice(0, 2)}</div>
          <div>
            <p className="sectionEyebrow compact">{company.shortName}</p>
            <h3>{company.name}</h3>
            <span className="tierBadge">Tier 1 suppliers</span>
          </div>
        </div>
        <button className="closeSidebar" type="button" aria-label="Close details">
          ×
        </button>
      </div>

      <div className="detailTabs" role="tablist" aria-label="Company detail tabs">
        <button className={activeTab === "overview" ? "tabButton active" : "tabButton"} onClick={() => onTabChange("overview")} type="button">
          Overview
        </button>
        <button className={activeTab === "evidence" ? "tabButton active" : "tabButton"} onClick={() => onTabChange("evidence")} type="button">
          Evidence
        </button>
        <button className={activeTab === "financials" ? "tabButton active" : "tabButton"} onClick={() => onTabChange("financials")} type="button">
          Financials
        </button>
      </div>

      <div className="evidenceKpis">
        <Metric label="Confirmed" value={`${evidenceSummary.confirmed}`} />
        <Metric label="Strong evidence" value={`${evidenceSummary.strongEvidence}`} />
        <Metric label="Inferred" value={`${evidenceSummary.inferred}`} />
      </div>

      <div className="detailPanelBody">
        {activeTab === "overview" ? (
          <>
            <div className="detailCard">
              <p className="sectionEyebrow compact">Current focus</p>
              <strong>{activeNode?.label ?? company.shortName}</strong>
              <p>{activeNode ? `${activeNode.kind} in ${activeNode.region}` : company.summary}</p>
            </div>

            <div className="detailMetricGrid">
              <MetricCard icon={<Buildings size={18} />} label="Primary region" value={company.primaryRegion} />
              <MetricCard icon={<ChartBar size={18} />} label="Market cap" value={formatCurrency(company.marketCapUsd)} />
              <MetricCard icon={<Stack size={18} />} label="Relations" value={`${company.stats.relationCount}`} />
              <MetricCard icon={<Database size={18} />} label="Critical deps" value={`${company.stats.criticalDependencyCount}`} />
            </div>

            <div className="detailCard">
              <p className="sectionEyebrow compact">Relationship picks</p>
              <div className="relationList">
                {relations.slice(0, 4).map((relation) => (
                  <button
                    key={relation.id}
                    className={relation.id === activeRelation?.id ? "sidebarRelation active" : "sidebarRelation"}
                    onClick={() => onRelationSelect(relation)}
                    type="button"
                  >
                    <span className="miniBadge">
                      <Path size={12} />
                      Tier {relation.tier}
                    </span>
                    <strong>{relation.summary}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="detailCard">
              <p className="sectionEyebrow compact">API boundary</p>
              <ul className="detailList">
                <li>{graphApiContract.companies}</li>
                <li>{company.apiBindings.graphEndpoint}</li>
                <li>{graphApiContract.evidence}</li>
                <li>
                  <LinkBreak size={14} /> Graph container and detail tabs consume typed DTOs only.
                </li>
              </ul>
            </div>
          </>
        ) : null}

        {activeTab === "evidence" ? <EvidencePanel evidence={evidence} relation={activeRelation} /> : null}

        {activeTab === "financials" ? (
          <>
            <div className="detailCard">
              <p className="sectionEyebrow compact">Financials</p>
              <strong>{formatCurrency(company.marketCapUsd)}</strong>
              <p>Node sizing is prepared to reflect market capitalization and relative ecosystem importance.</p>
            </div>

            <div className="detailCard">
              <p className="sectionEyebrow compact">Data contract</p>
              <ul className="detailList">
                <li>Overview: {company.apiBindings.overviewEndpoint}</li>
                <li>Graph: {company.apiBindings.graphEndpoint}</li>
                <li>Evidence: {company.apiBindings.evidenceEndpoint}</li>
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="evidenceMetric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MetricCard(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metricCard overlay">
      <div className="metricIcon">{props.icon}</div>
      <div>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(value);
}
