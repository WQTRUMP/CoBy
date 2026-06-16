import { ArrowSquareOut, FileText, ShieldCheck } from "@phosphor-icons/react";
import type { EvidenceViewModel, GraphRelationViewModel } from "../types/viewModels";

interface EvidencePanelProps {
  evidence: EvidenceViewModel[];
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  relation: GraphRelationViewModel | null;
}

export function EvidencePanel({ evidence, error, loading, onRetry, relation }: EvidencePanelProps) {
  const primaryEvidence = evidence[0] ?? null;

  return (
    <div className="evidenceTabPanel">
      {relation ? (
        <article className="sidebarCard evidenceContextCard">
          <p className="sidebarSectionLabel">来源证据</p>
          <strong>{relation.summary}</strong>
          <p>{relation.relationshipSemanticLabel}</p>
        </article>
      ) : null}

      {loading ? (
        <div className="inlineStatusCard" role="status" aria-live="polite">
          正在加载证据详情...
        </div>
      ) : null}

      {error ? (
        <div className="inlineStatusCard error" role="alert">
          <p>{error}</p>
          <button className="inlineActionButton" onClick={onRetry} type="button">
            重试证据加载
          </button>
        </div>
      ) : null}

      {!loading && !error && evidence.length === 0 ? (
        <div className="inlineStatusCard" role="status" aria-live="polite">
          选择一条关系以查看引用来源、可信度与审计元数据。
        </div>
      ) : null}

      <div className="evidenceCardStack">
        {evidence.map((item) => (
          <article className="evidenceCard" key={item.id}>
            <div className="evidenceCardHeader">
              <div className="evidenceThumb">
                <FileText size={20} />
              </div>
              <div className="evidenceHeaderCopy">
                <div className="evidenceLabelRow">
                  <span className="miniBadge">{item.sourceTypeLabel}</span>
                  <span className={`confidenceBadge ${item.confidence}`}>
                    <ShieldCheck size={12} />
                    {formatConfidence(item.confidence)}
                  </span>
                </div>
                <strong>{item.title}</strong>
                <span>
                  {item.publisher} · {item.publishedAt}
                </span>
              </div>
            </div>

            <p className="evidenceExcerpt">{item.excerpt || item.citation}</p>

            <div className="evidenceMetaGrid">
              <span>发布日期</span>
              <strong>{item.publishedAt}</strong>
              <span>报告期</span>
              <strong>{item.reportedPeriodEnd ?? "未提供"}</strong>
              <span>SKU 粒度</span>
              <strong>{item.skuGranularityLabel}</strong>
            </div>

            {item.skuGranularityBoundaryHint ? <p className="boundaryHint">{item.skuGranularityBoundaryHint}</p> : null}

            <a href={item.url} rel="noreferrer" target="_blank">
              <ArrowSquareOut size={14} />
              打开来源
            </a>
          </article>
        ))}
      </div>

      <article className="sidebarCard auditInfoCard">
        <p className="sidebarSectionLabel">证据审计信息</p>
        <dl className="auditGrid">
          <dt>发布时间</dt>
          <dd>{primaryEvidence?.publishedAt ?? "待绑定"}</dd>
          <dt>报告期</dt>
          <dd>{primaryEvidence?.reportedPeriodEnd ?? "待绑定"}</dd>
          <dt>抓取时间</dt>
          <dd>{primaryEvidence?.retrievedAt ?? "待绑定"}</dd>
          <dt>可信度</dt>
          <dd>{primaryEvidence ? formatConfidence(primaryEvidence.confidence) : relation ? formatConfidence(relation.confidence) : "待判定"}</dd>
          <dt>来源链接</dt>
          <dd className="auditLinkCell">{primaryEvidence?.url ?? "待绑定"}</dd>
        </dl>
      </article>
    </div>
  );
}

function formatConfidence(value: EvidenceViewModel["confidence"] | GraphRelationViewModel["confidence"]) {
  if (value === "strong_evidence") return "强证据";
  if (value === "confirmed") return "已确认";
  return "推断";
}
