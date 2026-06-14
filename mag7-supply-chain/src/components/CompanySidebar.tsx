import type { ReactNode } from "react";
import { Buildings, ChartBar, Database, LinkBreak, Stack } from "@phosphor-icons/react";
import type { CompanyDetail, GraphNodeDTO } from "../types/contracts";
import { graphApiContract } from "../services/graphExplorerApi";

interface CompanySidebarProps {
  activeNode: GraphNodeDTO | null;
  company: CompanyDetail;
}

export function CompanySidebar({ activeNode, company }: CompanySidebarProps) {
  return (
    <aside className="panel sidebarPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Company Sidebar</p>
          <h2>{company.name}</h2>
        </div>
        <span className={`riskBadge ${company.riskLevel}`}>{company.riskLevel}</span>
      </div>

      <p className="summaryText">{company.summary}</p>

      <div className="metricGrid">
        <Metric icon={<Buildings size={18} />} label="Primary region" value={company.primaryRegion} />
        <Metric icon={<ChartBar size={18} />} label="Market cap" value={formatCurrency(company.marketCapUsd)} />
        <Metric icon={<Stack size={18} />} label="Relations" value={`${company.stats.relationCount}`} />
        <Metric icon={<Database size={18} />} label="Critical deps" value={`${company.stats.criticalDependencyCount}`} />
      </div>

      <div className="infoCard">
        <p className="eyebrow">Selection</p>
        <strong>{activeNode?.label ?? company.shortName}</strong>
        <span>{activeNode ? `${activeNode.kind} · ${activeNode.region}` : "Select a node to inspect local context."}</span>
      </div>

      <div className="infoCard">
        <p className="eyebrow">API Boundary</p>
        <ul className="infoList">
          <li>{graphApiContract.companies}</li>
          <li>{company.apiBindings.graphEndpoint}</li>
          <li>{graphApiContract.evidence}</li>
        </ul>
      </div>

      <div className="infoCard">
        <p className="eyebrow">Planned seams</p>
        <ul className="infoList">
          <li>Graph canvas stays data-source agnostic.</li>
          <li>Evidence panel consumes relation-scoped DTOs only.</li>
          <li><LinkBreak size={14} /> Current state is mock-backed and ready for REST substitution.</li>
        </ul>
      </div>
    </aside>
  );
}

function Metric(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metricCard">
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
