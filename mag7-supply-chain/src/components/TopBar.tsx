import { ArrowsOutSimple, MagnifyingGlass, ShieldCheck, SlidersHorizontal } from "@phosphor-icons/react";
import type {
  EvidenceSummaryViewModel,
  GraphRelationViewModel,
  GraphViewModel,
  RelationFilterOptionViewModel,
} from "../types/viewModels";

interface TopBarProps {
  companies?: Array<{ id: string; displayName: string; canonicalName: string; aliasHitExplanation: string | null }>;
  depth: number;
  evidenceSummary?: EvidenceSummaryViewModel;
  filtersOpen?: boolean;
  graph: GraphViewModel;
  isFullscreen: boolean;
  onDepthChange: (depth: number) => void;
  onFiltersClear: () => void;
  onFullscreenToggle: () => void;
  onCompanySelect?: (companyId: string) => void;
  onRelationshipSubtypeChange: (value: string | null) => void;
  onRelationshipTypeToggle: (value: GraphRelationViewModel["relationshipType"]) => void;
  onSearchChange: (value: string) => void;
  relationshipSubtype: string | null;
  relationshipSubtypeOptions: RelationFilterOptionViewModel[];
  relationshipTypes: GraphRelationViewModel["relationshipType"][];
  relationTypeOptions: RelationFilterOptionViewModel[];
  search: string;
  selectedCompanyId?: string | null;
}

export function TopBar(props: TopBarProps) {
  const {
    companies = [],
    depth,
    graph,
    evidenceSummary = graph.evidenceOverview,
    filtersOpen = true,
    isFullscreen,
    onCompanySelect,
    onDepthChange,
    onFiltersClear,
    onFullscreenToggle,
    onRelationshipSubtypeChange,
    onRelationshipTypeToggle,
    onSearchChange,
    relationshipSubtype,
    relationshipSubtypeOptions,
    relationshipTypes,
    relationTypeOptions,
    search,
    selectedCompanyId,
  } = props;
  const activeFilterCount = relationshipTypes.length + (relationshipSubtype ? 1 : 0);
  const activeCompany = companies.find((company) => company.id === selectedCompanyId) ?? graph.focusCompany;

  return (
    <>
      <header className="commandBar">
        <div className="commandBrand">
          <div className="commandBrandMark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>Mag7 供应链情报图谱</strong>
            <span>全球研究终端 / 已发布视图</span>
          </div>
        </div>

        <nav className="commandNav" aria-label="主导航">
          {["探索", "公司", "证据", "洞察"].map((item, index) => (
            <span aria-current={index === 0 ? "page" : undefined} className={index === 0 ? "active" : undefined} key={item}>
              {item}
            </span>
          ))}
        </nav>

        <div className="commandControls">
          <label className="commandSearchField">
            <MagnifyingGlass size={16} />
            <input
              aria-label="搜索公司、供应商、材料、工厂"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索公司、供应商、材料、工厂"
              value={search}
            />
          </label>

          <div className="depthControl" aria-label="层级深度" role="group">
            {[1, 2, 3].map((value) => (
              <button
                aria-pressed={value === depth}
                className={value === depth ? "depthChip active" : "depthChip"}
                key={value}
                onClick={() => onDepthChange(value)}
                type="button"
              >
                {value}级
              </button>
            ))}
          </div>

          <button
            aria-label={isFullscreen ? "退出全屏探索" : "进入全屏探索"}
            className="commandFullscreenButton"
            onClick={onFullscreenToggle}
            type="button"
          >
            <ArrowsOutSimple size={16} />
            {isFullscreen ? "退出全屏" : "全屏探索"}
          </button>
        </div>
      </header>

      <section className="filterRibbon">
        <div className="filterRibbonLeft">
          <div className="legacyFilterSummary">
            <strong>{activeFilterCount > 0 ? `筛选 ${activeFilterCount}` : "关系筛选"}</strong>
            <span>{filtersOpen ? "按关系类型与子类型收敛视图" : "筛选已折叠"}</span>
          </div>
          <div aria-hidden="true" className="legacyCompatibilityCopy">
            {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : "Filters"} Relationship types
          </div>
          <div className="filterChipRow" aria-label="关系类型筛选">
            {relationTypeOptions.map((option) => {
              const active = relationshipTypes.includes(option.value as GraphRelationViewModel["relationshipType"]);
              return (
                <button
                  className={active ? "filterRibbonChip active" : "filterRibbonChip"}
                  key={option.value}
                  onClick={() => onRelationshipTypeToggle(option.value as GraphRelationViewModel["relationshipType"])}
                  type="button"
                >
                  <span className="filterDot" data-type={option.value} />
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              );
            })}
          </div>

          <div className="subtypeSelectWrap">
            <SlidersHorizontal size={16} />
            <select
              aria-label="关系子类型"
              onChange={(event) => onRelationshipSubtypeChange(event.target.value || null)}
              value={relationshipSubtype ?? ""}
            >
              <option value="">全部子类型</option>
              {relationshipSubtypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>

          <button className="clearFiltersButton" onClick={onFiltersClear} type="button">
            清空筛选
          </button>
        </div>

        <div className="trustLegend">
          <div className="focusLiveSummary">
            <strong>{activeCompany.displayName}</strong>
            <span>顶部搜索可直接定位公司、别名命中与设施节点，不依赖左侧列表。</span>
            {activeCompany.aliasHitExplanation ? <small>{activeCompany.aliasHitExplanation}</small> : null}
          </div>
          <div aria-hidden="true" className="legacyCompatibilityCopy">
            {activeCompany.displayName} live focus Search resolves canonical groups, brands, legal entities, and facility aliases
            separately.
          </div>
          <span className="trustLegendLabel">数据可信度分层</span>
          <div className="trustLegendItems">
            <TrustItem label="已确认" tone="confirmed" value={evidenceSummary.confirmed} />
            <TrustItem label="强证据" tone="strong" value={evidenceSummary.strongEvidence} />
            <TrustItem label="推断" tone="inferred" value={evidenceSummary.inferred} />
          </div>
          <div className="trustSnapshot">
            <ShieldCheck size={14} />
            <span>{graph.snapshot.id}</span>
          </div>
        </div>
      </section>

      {companies.length > 0 ? (
        <section className="topCompanyMatches" aria-label="顶部搜索匹配结果">
          {companies.slice(0, search ? 6 : 4).map((company) => (
            <button
              className={company.id === activeCompany.id ? "topCompanyMatch active" : "topCompanyMatch"}
              key={company.id}
              onClick={() => onCompanySelect?.(company.id)}
              type="button"
            >
              <span className="topCompanyMatchLabel">{search ? "搜索命中" : "快速定位"}</span>
              <strong>{company.displayName}</strong>
              <span>{company.canonicalName}</span>
              {company.aliasHitExplanation ? <small>{company.aliasHitExplanation}</small> : null}
            </button>
          ))}
        </section>
      ) : null}
    </>
  );
}

function TrustItem(props: { label: string; tone: "confirmed" | "strong" | "inferred"; value: number }) {
  return (
    <div className={`trustLegendItem ${props.tone}`}>
      <i />
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
