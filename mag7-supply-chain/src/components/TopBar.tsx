import { ArrowsOutSimple, MagnifyingGlass, ShieldCheck, SlidersHorizontal } from "@phosphor-icons/react";
import type {
  EvidenceSummaryViewModel,
  GraphRelationViewModel,
  GraphViewModel,
  RelationFilterOptionViewModel,
} from "../types/viewModels";

interface TopBarProps {
  depth: number;
  evidenceSummary: EvidenceSummaryViewModel;
  graph: GraphViewModel;
  isFullscreen: boolean;
  onDepthChange: (depth: number) => void;
  onFiltersClear: () => void;
  onFullscreenToggle: () => void;
  onRelationshipSubtypeChange: (value: string | null) => void;
  onRelationshipTypeToggle: (value: GraphRelationViewModel["relationshipType"]) => void;
  onSearchChange: (value: string) => void;
  relationshipSubtype: string | null;
  relationshipSubtypeOptions: RelationFilterOptionViewModel[];
  relationshipTypes: GraphRelationViewModel["relationshipType"][];
  relationTypeOptions: RelationFilterOptionViewModel[];
  search: string;
}

export function TopBar(props: TopBarProps) {
  const {
    depth,
    evidenceSummary,
    graph,
    isFullscreen,
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
  } = props;

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
            <a className={index === 0 ? "active" : undefined} href="/" key={item} onClick={(event) => event.preventDefault()}>
              {item}
            </a>
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
