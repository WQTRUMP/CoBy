import { MagnifyingGlass, TrendUp } from "@phosphor-icons/react";
import type { CompanyOptionViewModel, CompanyProfileViewModel } from "../types/viewModels";

interface ExplorerCommandRailProps {
  activeCompanyId: string;
  coveredRegions: number;
  focusCompany: CompanyProfileViewModel;
  onCompanySelect: (companyId: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
  searchResults: CompanyOptionViewModel[];
  tier1SupplierCount: number;
}

export function ExplorerCommandRail(props: ExplorerCommandRailProps) {
  const { activeCompanyId, coveredRegions, focusCompany, onCompanySelect, onSearchChange, search, searchResults, tier1SupplierCount } = props;

  return (
    <aside className="commandRail">
      <section className="railPanel focusCompanyCard">
        <p className="railLabel">当前焦点公司</p>
        <div className="focusCompanyHeader">
          <div className="focusCompanyLogo">{focusCompany.ticker.slice(0, 1)}</div>
          <div>
            <strong>{focusCompany.displayName}</strong>
            <span>{focusCompany.canonicalName}</span>
          </div>
        </div>
        <div className="focusCompanyStats">
          <div>
            <span>市值 (USD)</span>
            <strong>{formatMarketCap(focusCompany.marketCapUsd)}</strong>
          </div>
          <div>
            <span>关键供应商</span>
            <strong>{tier1SupplierCount.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span>覆盖国家/地区</span>
            <strong>{coveredRegions}</strong>
          </div>
        </div>
      </section>

      <section className="railPanel">
        <label className="railSearchField">
          <MagnifyingGlass size={16} />
          <input
            aria-label="左侧搜索结果同步"
            onChange={(event) => onSearchChange(event.target.value)}
            value={search}
            placeholder="搜索公司或供应商"
          />
        </label>
      </section>

      <section className="railPanel searchResultsPanel">
        <div className="railSectionHeader">
          <strong>搜索结果 ({searchResults.length})</strong>
          <span>{search ? `关键词：${search}` : "图谱定位列表"}</span>
        </div>
        <div className="searchResultsList">
          {searchResults.slice(0, 8).map((company) => {
            const isActive = company.id === activeCompanyId;
            return (
              <button
                key={company.id}
                className={isActive ? "searchResultRow active" : "searchResultRow"}
                onClick={() => onCompanySelect(company.id)}
                type="button"
              >
                <div className="searchResultAvatar">{company.ticker.slice(0, 1)}</div>
                <div className="searchResultContent">
                  <strong>{company.displayName}</strong>
                  <span>{company.canonicalName}</span>
                  <small>{company.aliasHitExplanation ?? company.hierarchySummary}</small>
                </div>
                <TrendUp size={16} weight={isActive ? "fill" : "regular"} />
              </button>
            );
          })}
        </div>
        <p className="viewAllHint">显示前 8 项；完整定位入口请使用顶部搜索结果条。</p>
      </section>
    </aside>
  );
}

function formatMarketCap(value: number | null) {
  if (!value || value <= 0) {
    return "待补充";
  }

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(3)}万亿`;
  }

  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}亿`;
  }

  return value.toLocaleString("zh-CN");
}
