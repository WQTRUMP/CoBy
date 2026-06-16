import type {
  CompanyProfileViewModel,
  EvidenceSummaryViewModel,
  EvidenceViewModel,
  GraphRelationViewModel,
} from "../types/viewModels";
import { EvidencePanel } from "./EvidencePanel";

interface MobileEvidenceSheetProps {
  activeRelation: GraphRelationViewModel | null;
  activeTab: "overview" | "evidence" | "financials";
  company: CompanyProfileViewModel;
  depth: number;
  evidence: EvidenceViewModel[];
  evidenceError: string | null;
  evidenceLoading: boolean;
  evidenceSummary: EvidenceSummaryViewModel;
  onRetryEvidence: () => void;
  onTabChange: (tab: "overview" | "evidence" | "financials") => void;
}

export function MobileEvidenceSheet(props: MobileEvidenceSheetProps) {
  const { activeRelation, activeTab, company, depth, evidence, evidenceError, evidenceLoading, evidenceSummary, onRetryEvidence, onTabChange } =
    props;

  return (
    <section className="mobileEvidenceShell" aria-label="移动端证据抽屉骨架">
      <div className="mobilePhoneFrame">
        <div className="mobilePhoneBar">
          <strong>Mag7 供应链情报图谱</strong>
          <span>9:41</span>
        </div>

        <div className="mobileExplorerPreview">
          <div className="mobileQuickChips">
            <span>{depth}级穿透</span>
            <span>全屏探索</span>
          </div>
          <div className="mobileMiniGraph">
            <span>{company.displayName}</span>
            <small>图谱优先，证据一触达</small>
          </div>
        </div>

        <div className="mobileBottomSheet">
          <div className="mobileSheetHandle" />
          <div className="mobileSheetHeader">
            <strong>来源证据</strong>
            <span>{company.displayName}</span>
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
              <EvidencePanel evidence={evidence.slice(0, 2)} error={evidenceError} loading={evidenceLoading} onRetry={onRetryEvidence} relation={activeRelation} />
            ) : (
              <article className="mobileSummaryCard">
                <strong>{activeTab === "overview" ? "图谱概览" : "财务摘要"}</strong>
                <p>
                  {activeTab === "overview"
                    ? "桌面侧栏在移动端收敛为半开底部抽屉，保留证据与审计信息入口。"
                    : "财务标签预留市值、关系暴露度与依赖集中度的移动端展示位。"}
                </p>
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
