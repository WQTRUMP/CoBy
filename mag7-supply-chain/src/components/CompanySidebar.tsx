import { ChartBar, GlobeHemisphereWest, LinkBreak, Path, Rows, X } from "@phosphor-icons/react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type {
  CompanyProfileViewModel,
  EvidenceSummaryViewModel,
  EvidenceViewModel,
  GraphNodeViewModel,
  GraphRelationViewModel,
} from "../types/viewModels";
import { EvidencePanel } from "./EvidencePanel.js";
import { graphApiContract } from "../services/graphExplorerApi.js";

interface CompanySidebarProps {
  activeNode: GraphNodeViewModel | null;
  activeRelation: GraphRelationViewModel | null;
  activeTab: "overview" | "evidence" | "financials";
  company: CompanyProfileViewModel;
  depth?: number;
  evidence: EvidenceViewModel[];
  evidenceError: string | null;
  evidenceLoading: boolean;
  evidenceSummary: EvidenceSummaryViewModel;
  isOpen?: boolean;
  onClose?: () => void;
  onRelationSelect: (relation: GraphRelationViewModel) => void;
  onRetryEvidence?: () => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
  relations: GraphRelationViewModel[];
}

export const companySidebarTabOrder = ["overview", "evidence", "financials"] as const;
export type CompanySidebarTab = (typeof companySidebarTabOrder)[number];

export function getNextCompanySidebarTab(currentTab: CompanySidebarTab, key: string): CompanySidebarTab | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight") {
    return null;
  }

  const currentIndex = companySidebarTabOrder.indexOf(currentTab);
  const direction = key === "ArrowRight" ? 1 : -1;
  const nextIndex = (currentIndex + direction + companySidebarTabOrder.length) % companySidebarTabOrder.length;
  return companySidebarTabOrder[nextIndex];
}

export function CompanySidebar(props: CompanySidebarProps) {
  const {
    activeNode,
    activeRelation,
    activeTab,
    company,
    depth = 3,
    evidence,
    evidenceError,
    evidenceLoading,
    evidenceSummary,
    isOpen = true,
    onClose = () => undefined,
    onRelationSelect,
    onRetryEvidence = () => undefined,
    onTabChange,
    relations,
  } = props;
  const overviewTabId = "company-tab-overview";
  const evidenceTabId = "company-tab-evidence";
  const financialsTabId = "company-tab-financials";
  const overviewPanelId = "company-panel-overview";
  const evidencePanelId = "company-panel-evidence";
  const financialsPanelId = "company-panel-financials";
  const tabRefs = useRef<Record<CompanySidebarTab, HTMLButtonElement | null>>({
    overview: null,
    evidence: null,
    financials: null,
  });
  const pendingFocusTabRef = useRef<CompanySidebarTab | null>(null);

  useEffect(() => {
    if (pendingFocusTabRef.current !== activeTab) {
      return;
    }

    tabRefs.current[activeTab]?.focus();
    pendingFocusTabRef.current = null;
  }, [activeTab]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: CompanySidebarTab) {
    const nextTab = getNextCompanySidebarTab(tab, event.key);
    if (!nextTab) {
      return;
    }

    event.preventDefault();
    pendingFocusTabRef.current = nextTab;
    onTabChange(nextTab);
  }

  return (
    <aside className={isOpen ? "evidenceSidebar isOpen" : "evidenceSidebar"} aria-hidden={!isOpen}>
      <div className="evidenceSidebarHeader">
        <div className="evidenceSidebarCompany">
          <div className="evidenceSidebarLogo">{company.ticker.slice(0, 1)}</div>
          <div>
            <h3>{company.displayName}</h3>
            <p>焦点公司</p>
          </div>
        </div>
        <button aria-label="关闭证据侧栏" className="closeSidebar" onClick={onClose} type="button">
          <X size={16} />
        </button>
      </div>

      <div className="detailTabs" role="tablist" aria-label="公司详情标签">
        <button
          aria-controls={overviewPanelId}
          aria-selected={activeTab === "overview"}
          className={activeTab === "overview" ? "tabButton active" : "tabButton"}
          id={overviewTabId}
          onClick={() => onTabChange("overview")}
          onKeyDown={(event) => handleTabKeyDown(event, "overview")}
          ref={(node) => {
            tabRefs.current.overview = node;
          }}
          role="tab"
          tabIndex={activeTab === "overview" ? 0 : -1}
          type="button"
        >
          Overview
        </button>
        <button
          aria-controls={evidencePanelId}
          aria-selected={activeTab === "evidence"}
          className={activeTab === "evidence" ? "tabButton active" : "tabButton"}
          id={evidenceTabId}
          onClick={() => onTabChange("evidence")}
          onKeyDown={(event) => handleTabKeyDown(event, "evidence")}
          ref={(node) => {
            tabRefs.current.evidence = node;
          }}
          role="tab"
          tabIndex={activeTab === "evidence" ? 0 : -1}
          type="button"
        >
          Evidence
        </button>
        <button
          aria-controls={financialsPanelId}
          aria-selected={activeTab === "financials"}
          className={activeTab === "financials" ? "tabButton active" : "tabButton"}
          id={financialsTabId}
          onClick={() => onTabChange("financials")}
          onKeyDown={(event) => handleTabKeyDown(event, "financials")}
          ref={(node) => {
            tabRefs.current.financials = node;
          }}
          role="tab"
          tabIndex={activeTab === "financials" ? 0 : -1}
          type="button"
        >
          Financials
        </button>
      </div>

      <div className="evidenceKpis">
        <Metric label="已确认" value={`${evidenceSummary.confirmed}`} tone="confirmed" />
        <Metric label="强证据" value={`${evidenceSummary.strongEvidence}`} tone="strong" />
        <Metric label="推断" value={`${evidenceSummary.inferred}`} tone="inferred" />
      </div>

      <div className="evidenceSidebarBody">
        {activeTab === "overview" ? (
          <div aria-labelledby={overviewTabId} id={overviewPanelId} role="tabpanel">
            <div className="sidebarCard">
              <p className="sidebarSectionLabel">公司锚点</p>
              <strong>{activeNode?.displayName ?? company.displayName}</strong>
              <p>{company.summary}</p>
            </div>

            <div className="sidebarMetricsGrid">
              <MetricCard icon={<ChartBar size={16} />} label="市值" value={formatCurrency(company.marketCapUsd)} />
              <MetricCard icon={<Rows size={16} />} label="关系数" value={`${company.overview.relationCount}`} />
              <MetricCard icon={<GlobeHemisphereWest size={16} />} label="区域" value={company.primaryRegion} />
              <MetricCard icon={<Path size={16} />} label="穿透层级" value={`${depth}级`} />
            </div>

            {activeRelation ? (
              <div className="sidebarCard">
                <p className="sidebarSectionLabel">当前关系</p>
                <strong>{activeRelation.relationshipSemanticLabel}</strong>
                <dl className="auditGrid compact">
                  <dt>关系类型</dt>
                  <dd>{activeRelation.relationshipTypeLabel}</dd>
                  <dt>子类型</dt>
                  <dd>{activeRelation.relationshipSubtypeLabel ?? "未标注"}</dd>
                  <dt>来源方法</dt>
                  <dd>{activeRelation.sourceMethodLabel ?? "未标注"}</dd>
                  <dt>时间粒度</dt>
                  <dd>{activeRelation.evidenceDateResolutionLabel ?? "未标注"}</dd>
                  <dt>有效期</dt>
                  <dd>{activeRelation.validityLabel}</dd>
                </dl>
              </div>
            ) : null}

            <div className="sidebarCard">
              <p className="sidebarSectionLabel">重点关系</p>
              <div className="sidebarRelationList">
                {relations.slice(0, 4).map((relation) => (
                  <button
                    className={relation.id === activeRelation?.id ? "sidebarRelation active" : "sidebarRelation"}
                    key={relation.id}
                    onClick={() => onRelationSelect(relation)}
                    type="button"
                  >
                    <span>{relation.relationshipTypeLabel}</span>
                    <strong>{relation.summary}</strong>
                    <small>{relation.relationshipSubtypeLabel ?? relation.relationshipSemanticLabel}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebarCard">
              <p className="sidebarSectionLabel">实体层级</p>
              <strong>Group / brand / legal entity / facility</strong>
              <p>{company.hierarchySummary}</p>
              <ul className="detailList">
                <li>Group: {company.canonicalName}</li>
                <li>Display: {company.displayName}</li>
                <li>Legal entities: {company.entityProfile?.legalEntities.map((item) => item.name).join(", ") || "No legal entity aliases"}</li>
                <li>Brands: {company.entityProfile?.brands.map((item) => item.name).join(", ") || "No brand aliases"}</li>
                <li>
                  Facilities:{" "}
                  {company.entityProfile?.aliases.filter((item) => item.aliasType === "facility").map((item) => item.name).join(", ") ||
                    "Facility nodes stay separate in the graph"}
                </li>
              </ul>
              {company.aliasHitExplanation ? <p>{company.aliasHitExplanation}</p> : null}
            </div>

            <div className="sidebarCard">
              <p className="sidebarSectionLabel">API 边界</p>
              <ul className="detailList">
                <li>{graphApiContract.companies}</li>
                <li>{company.apiBindings.companyEndpoint}</li>
                <li>{company.apiBindings.graphEndpoint}</li>
                <li>{company.apiBindings.evidenceEndpoint}</li>
                <li>
                  <LinkBreak size={14} /> 侧栏继续消费 typed DTO 与 view-model 适配层。
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        {activeTab === "evidence" ? (
          <div aria-labelledby={evidenceTabId} id={evidencePanelId} role="tabpanel">
            <EvidencePanel evidence={evidence} error={evidenceError} loading={evidenceLoading} onRetry={onRetryEvidence} relation={activeRelation} />
          </div>
        ) : null}

        {activeTab === "financials" ? (
          <div aria-labelledby={financialsTabId} id={financialsPanelId} role="tabpanel">
            <div className="sidebarCard">
              <p className="sidebarSectionLabel">财务摘要</p>
              <strong>{formatCurrency(company.marketCapUsd)}</strong>
              <p>节点大小持续绑定市值与生态重要性，后续可接入采购暴露度与集中度指标。</p>
            </div>

            <div className="sidebarCard">
              <p className="sidebarSectionLabel">预留指标</p>
              <dl className="auditGrid compact">
                <dt>供应商总量</dt>
                <dd>{company.overview.supplierCount}</dd>
                <dt>一级供应商</dt>
                <dd>{company.overview.tier1SupplierCount}</dd>
                <dt>证据覆盖</dt>
                <dd>{Math.round(company.overview.evidenceCoverage * 100)}%</dd>
                <dt>高风险依赖</dt>
                <dd>{company.overview.criticalDependencyCount}</dd>
              </dl>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Metric(props: { label: string; tone: "confirmed" | "strong" | "inferred"; value: string }) {
  return (
    <div className={`evidenceMetric ${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MetricCard(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="sidebarMetricCard">
      <div className="sidebarMetricIcon">{props.icon}</div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (!value || value <= 0) {
    return "待补充";
  }

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(3)} 万亿`;
  }

  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)} 亿`;
  }

  return value.toLocaleString("zh-CN");
}
