import type {
  CompanyProfileViewModel,
  EvidenceSummaryViewModel,
  EvidenceViewModel,
  GraphNodeViewModel,
  GraphRelationViewModel,
} from "../types/viewModels";
import { EvidencePanel } from "./EvidencePanel";

interface MobileEvidenceSheetProps {
  activeNode: GraphNodeViewModel | null;
  activeRelation: GraphRelationViewModel | null;
  activeTab: "overview" | "evidence" | "financials";
  company: CompanyProfileViewModel;
  depth: number;
  evidence: EvidenceViewModel[];
  evidenceError: string | null;
  evidenceLoading: boolean;
  evidenceSummary: EvidenceSummaryViewModel;
  isExpanded: boolean;
  isOpen: boolean;
  onClose: () => void;
  onExpandToggle: () => void;
  onOpen: () => void;
  onRetryEvidence: () => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
}

export function MobileEvidenceSheet(props: MobileEvidenceSheetProps) {
  const {
    activeNode,
    activeRelation,
    activeTab,
    company,
    depth,
    evidence,
    evidenceError,
    evidenceLoading,
    evidenceSummary,
    isExpanded,
    isOpen,
    onClose,
    onExpandToggle,
    onOpen,
    onRetryEvidence,
    onTabChange,
  } = props;

  return (
    <section className={isOpen ? "mobileEvidenceShell isOpen" : "mobileEvidenceShell"} aria-label="移动端证据抽屉">
      <button
        aria-expanded={isOpen}
        className={isOpen ? "mobileSheetPeek isHidden" : "mobileSheetPeek"}
        onClick={onOpen}
        type="button"
      >
        打开来源证据
      </button>

      <div className={isExpanded ? "mobileBottomSheet isExpanded" : "mobileBottomSheet"} role="dialog" aria-modal="false">
        <div className="mobileSheetControls">
          <button
            aria-label={isExpanded ? "收起证据抽屉" : "展开证据抽屉"}
            className="mobileSheetHandleButton"
            onClick={onExpandToggle}
            type="button"
          >
            <span className="mobileSheetHandle" />
          </button>
          <button aria-label="关闭移动端证据抽屉" className="mobileSheetClose" onClick={onClose} type="button">
            收起
          </button>
        </div>

        <div className="mobileSheetSurface">
          <div className="mobileSheetHeader">
            <strong>来源证据</strong>
            <span>
              {company.displayName} / {depth}级穿透
            </span>
          </div>
          <div className="mobileTabs" role="tablist" aria-label="移动端详情标签">
            <button
              aria-selected={activeTab === "overview"}
              className={activeTab === "overview" ? "mobileTab active" : "mobileTab"}
              onClick={() => onTabChange("overview")}
              role="tab"
              type="button"
            >
              概览
            </button>
            <button
              aria-selected={activeTab === "evidence"}
              className={activeTab === "evidence" ? "mobileTab active" : "mobileTab"}
              onClick={() => onTabChange("evidence")}
              role="tab"
              type="button"
            >
              证据
            </button>
            <button
              aria-selected={activeTab === "financials"}
              className={activeTab === "financials" ? "mobileTab active" : "mobileTab"}
              onClick={() => onTabChange("financials")}
              role="tab"
              type="button"
            >
              财务
            </button>
          </div>

          <div className="mobileEvidenceKpis">
            <Metric label="已确认" value={evidenceSummary.confirmed} />
            <Metric label="强证据" value={evidenceSummary.strongEvidence} />
            <Metric label="推断" value={evidenceSummary.inferred} />
          </div>

          <div className="mobileEvidenceBody">
            {activeTab === "evidence" ? (
              <EvidencePanel evidence={evidence} error={evidenceError} loading={evidenceLoading} onRetry={onRetryEvidence} relation={activeRelation} />
            ) : (
              <article className="mobileSummaryCard">
                <strong>{activeTab === "overview" ? "图谱概览" : "财务摘要"}</strong>
                {activeTab === "overview" ? (
                  <>
                    <p>{activeNode?.displayName ?? company.displayName}</p>
                    <p>当前焦点节点与右侧桌面侧栏共享同一套概览、证据与财务上下文。</p>
                  </>
                ) : (
                  <>
                    <p>市值：{formatMarketCap(company.marketCapUsd)}</p>
                    <p>供应商总量 {company.overview.supplierCount}，一级供应商 {company.overview.tier1SupplierCount}。</p>
                  </>
                )}
                {activeRelation ? <p>当前关系：{activeRelation.summary}</p> : null}
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="mobileMetric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function formatMarketCap(value: number | null) {
  if (!value || value <= 0) {
    return "待补充";
  }

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(3)}万亿 USD`;
  }

  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}亿 USD`;
  }

  return `${value.toLocaleString("zh-CN")} USD`;
}
