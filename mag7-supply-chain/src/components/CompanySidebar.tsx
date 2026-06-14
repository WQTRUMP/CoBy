import type { ReactNode } from "react";
import { Buildings, ChartBar, Database, LinkBreak, Path, Stack } from "@phosphor-icons/react";
import { EvidencePanel } from "./EvidencePanel.js";
import type {
  CompanyProfileViewModel,
  EvidenceSummaryViewModel,
  EvidenceViewModel,
  GraphNodeViewModel,
  GraphRelationViewModel,
} from "../types/viewModels";
import { graphApiContract } from "../services/graphExplorerApi.js";

interface CompanySidebarProps {
  activeNode: GraphNodeViewModel | null;
  activeRelation: GraphRelationViewModel | null;
  activeTab: "overview" | "evidence" | "financials";
  company: CompanyProfileViewModel;
  evidence: EvidenceViewModel[];
  evidenceSummary: EvidenceSummaryViewModel;
  onRelationSelect: (relation: GraphRelationViewModel) => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
  relations: GraphRelationViewModel[];
}

export function CompanySidebar(props: CompanySidebarProps) {
  const { activeNode, activeRelation, activeTab, company, evidence, evidenceSummary, onRelationSelect, onTabChange, relations } = props;

  return (
    <aside className="detailSidebar">
      <div className="detailSidebarHeader">
        <div className="detailCompany">
          <div className="detailLogo">{company.ticker.slice(0, 2)}</div>
          <div>
            <p className="sectionEyebrow compact">{company.ticker || company.canonicalName}</p>
            <h3>{company.displayName}</h3>
            <p>{company.canonicalName}</p>
            {company.aliasHitExplanation ? <p>{company.aliasHitExplanation}</p> : null}
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
              <strong>{activeNode?.displayName ?? company.displayName}</strong>
              <p>{activeNode ? `${activeNode.kindLabel} in ${activeNode.region}` : company.summary}</p>
              <p>{activeNode?.hierarchySummary ?? company.hierarchySummary}</p>
            </div>

            {activeRelation ? (
              <div className="detailCard relationContextCard">
                <p className="sectionEyebrow compact">Selected relationship</p>
                <strong>{activeRelation.relationshipSemanticLabel}</strong>
                <div className="metaGrid">
                  <span>Type</span>
                  <strong>{activeRelation.relationshipTypeLabel}</strong>
                  <span>Subtype</span>
                  <strong>{activeRelation.relationshipSubtypeLabel ?? "Not specified"}</strong>
                  <span>Source method</span>
                  <strong>{activeRelation.sourceMethodLabel ?? "Not specified"}</strong>
                  <span>Evidence precision</span>
                  <strong>{activeRelation.evidenceDateResolutionLabel ?? "Not specified"}</strong>
                  <span>Valid from</span>
                  <strong>
                    {activeRelation.validFrom
                      ? `${activeRelation.validFrom} (${activeRelation.validFromResolutionLabel ?? "Unspecified resolution"})`
                      : "Not specified"}
                  </strong>
                  <span>Valid to</span>
                  <strong>
                    {activeRelation.validTo
                      ? `${activeRelation.validTo} (${activeRelation.validToResolutionLabel ?? "Unspecified resolution"})`
                      : "Open"}
                  </strong>
                  <span>Validity</span>
                  <strong>{activeRelation.validityLabel}</strong>
                  <span>Validity note</span>
                  <strong>{activeRelation.validityNote ?? "No additional note"}</strong>
                </div>
              </div>
            ) : null}

            <div className="detailCard">
              <p className="sectionEyebrow compact">Entity layers</p>
              <strong>Group / brand / legal entity / facility</strong>
              <p>{company.hierarchySummary}</p>
              <ul className="detailList">
                <li>Group: {company.canonicalName}</li>
                <li>Display: {company.displayName}</li>
                <li>
                  Legal entities: {company.entityProfile?.legalEntities.map((item) => item.name).join(", ") || "No legal entity aliases in payload"}
                </li>
                <li>Brands: {company.entityProfile?.brands.map((item) => item.name).join(", ") || "No brand aliases in payload"}</li>
                <li>
                  Facilities:{" "}
                  {company.entityProfile?.aliases.filter((item) => item.aliasType === "facility").map((item) => item.name).join(", ") ||
                    "Facility nodes stay separate in the graph when available"}
                </li>
              </ul>
            </div>

            <div className="detailMetricGrid">
              <MetricCard icon={<Buildings size={18} />} label="Primary region" value={company.primaryRegion} />
              <MetricCard icon={<ChartBar size={18} />} label="Market cap" value={formatCurrency(company.marketCapUsd)} />
              <MetricCard icon={<Stack size={18} />} label="Relations" value={`${company.overview.relationCount}`} />
              <MetricCard icon={<Database size={18} />} label="Critical deps" value={`${company.overview.criticalDependencyCount}`} />
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
                    <span className="miniBadge semantic">{relation.relationshipTypeLabel}</span>
                    <strong>{relation.summary}</strong>
                    <p>{relation.relationshipSemanticLabel}</p>
                    <p>{relation.relationshipSubtypeLabel ?? "Subtype not specified"}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="detailCard">
              <p className="sectionEyebrow compact">API boundary</p>
              <ul className="detailList">
                <li>{graphApiContract.companies}</li>
                <li>{company.apiBindings.companyEndpoint}</li>
                <li>{company.apiBindings.overviewEndpoint}</li>
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

function formatCurrency(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "USD",
  }).format(value);
}
