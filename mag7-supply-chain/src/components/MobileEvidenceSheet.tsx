import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
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
  isMobileViewport: boolean;
  isExpanded: boolean;
  isOpen: boolean;
  onExpand: (value: boolean) => void;
  onClose: () => void;
  onOpen: () => void;
  onRetryEvidence: () => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
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
    isMobileViewport,
    isExpanded,
    isOpen,
    onExpand,
    onClose,
    onOpen,
    onRetryEvidence,
    onTabChange,
    triggerRef,
  } = props;
  const titleId = useId();
  const overviewTabId = useId();
  const evidenceTabId = useId();
  const financialsTabId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelTabOrder = ["overview", "evidence", "financials"] as const;

  useEffect(() => {
    if (!isMobileViewport || !isOpen) {
      return;
    }

    closeButtonRef.current?.focus();
  }, [isMobileViewport, isOpen]);

  function getNextTab(currentTab: (typeof panelTabOrder)[number], key: string) {
    if (key !== "ArrowLeft" && key !== "ArrowRight") {
      return null;
    }

    const currentIndex = panelTabOrder.indexOf(currentTab);
    const direction = key === "ArrowRight" ? 1 : -1;
    return panelTabOrder[(currentIndex + direction + panelTabOrder.length) % panelTabOrder.length];
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: (typeof panelTabOrder)[number]) {
    const nextTab = getNextTab(currentTab, event.key);
    if (!nextTab) {
      return;
    }

    event.preventDefault();
    onTabChange(nextTab);
  }

  if (!isMobileViewport) {
    return null;
  }

  return (
    <section className={isOpen ? "mobileEvidenceShell isOpen" : "mobileEvidenceShell"} aria-label="移动端证据抽屉">
      <button
        aria-expanded={isOpen}
        aria-controls="mobile-evidence-sheet"
        className={isOpen ? "mobileSheetPeek isHidden" : "mobileSheetPeek"}
        onClick={onOpen}
        ref={triggerRef}
        type="button"
      >
        查看概览、证据与财务
      </button>

      <div
        aria-labelledby={titleId}
        className={isExpanded ? "mobileBottomSheet isExpanded" : "mobileBottomSheet"}
        id="mobile-evidence-sheet"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        role="dialog"
        aria-modal="false"
      >
        <div className="mobileSheetControls">
          <button
            aria-label={isExpanded ? "收起证据抽屉" : "展开证据抽屉"}
            className="mobileSheetHandleButton"
            onClick={() => onExpand(!isExpanded)}
            type="button"
          >
            <span className="mobileSheetHandle" />
          </button>
          <button
            aria-label="关闭移动端证据抽屉"
            className="mobileSheetClose"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            收起
          </button>
        </div>

        <div className="mobileSheetSurface">
          <div className="mobileSheetHeader">
            <strong id={titleId}>来源证据</strong>
            <span>
              {company.displayName} / {depth}级穿透
            </span>
          </div>
          <div className="mobileTabs" role="tablist" aria-label="移动端详情标签">
            <button
              aria-controls="mobile-panel-overview"
              aria-selected={activeTab === "overview"}
              className={activeTab === "overview" ? "mobileTab active" : "mobileTab"}
              id={overviewTabId}
              onClick={() => onTabChange("overview")}
              onKeyDown={(event) => handleTabKeyDown(event, "overview")}
              role="tab"
              tabIndex={activeTab === "overview" ? 0 : -1}
              type="button"
            >
              概览
            </button>
            <button
              aria-controls="mobile-panel-evidence"
              aria-selected={activeTab === "evidence"}
              className={activeTab === "evidence" ? "mobileTab active" : "mobileTab"}
              id={evidenceTabId}
              onClick={() => onTabChange("evidence")}
              onKeyDown={(event) => handleTabKeyDown(event, "evidence")}
              role="tab"
              tabIndex={activeTab === "evidence" ? 0 : -1}
              type="button"
            >
              证据
            </button>
            <button
              aria-controls="mobile-panel-financials"
              aria-selected={activeTab === "financials"}
              className={activeTab === "financials" ? "mobileTab active" : "mobileTab"}
              id={financialsTabId}
              onClick={() => onTabChange("financials")}
              onKeyDown={(event) => handleTabKeyDown(event, "financials")}
              role="tab"
              tabIndex={activeTab === "financials" ? 0 : -1}
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
              <div aria-labelledby={evidenceTabId} id="mobile-panel-evidence" role="tabpanel">
                <EvidencePanel
                  evidence={evidence}
                  error={evidenceError}
                  loading={evidenceLoading}
                  onRetry={onRetryEvidence}
                  relation={activeRelation}
                />
              </div>
            ) : (
              <article
                aria-labelledby={activeTab === "overview" ? overviewTabId : financialsTabId}
                className="mobileSummaryCard"
                id={activeTab === "overview" ? "mobile-panel-overview" : "mobile-panel-financials"}
                role="tabpanel"
              >
                <strong>{activeTab === "overview" ? "图谱概览" : "财务摘要"}</strong>
                {activeTab === "overview" ? (
                  <>
                    <p>{activeNode?.displayName ?? company.displayName}</p>
                    <p>当前焦点节点与桌面侧栏共享同一套概览、证据与财务上下文。</p>
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
