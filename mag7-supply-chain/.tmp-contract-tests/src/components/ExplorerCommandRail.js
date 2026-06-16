import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MagnifyingGlass, TrendUp } from "@phosphor-icons/react";
export function ExplorerCommandRail(props) {
    const { activeCompanyId, coveredRegions, focusCompany, onCompanySelect, search, searchResults, tier1SupplierCount } = props;
    return (_jsxs("aside", { className: "commandRail", children: [_jsxs("section", { className: "railPanel focusCompanyCard", children: [_jsx("p", { className: "railLabel", children: "\u5F53\u524D\u7126\u70B9\u516C\u53F8" }), _jsxs("div", { className: "focusCompanyHeader", children: [_jsx("div", { className: "focusCompanyLogo", children: focusCompany.ticker.slice(0, 1) }), _jsxs("div", { children: [_jsx("strong", { children: focusCompany.displayName }), _jsx("span", { children: focusCompany.canonicalName })] })] }), _jsxs("div", { className: "focusCompanyStats", children: [_jsxs("div", { children: [_jsx("span", { children: "\u5E02\u503C (USD)" }), _jsx("strong", { children: formatMarketCap(focusCompany.marketCapUsd) })] }), _jsxs("div", { children: [_jsx("span", { children: "\u5173\u952E\u4F9B\u5E94\u5546" }), _jsx("strong", { children: tier1SupplierCount.toLocaleString("zh-CN") })] }), _jsxs("div", { children: [_jsx("span", { children: "\u8986\u76D6\u56FD\u5BB6/\u5730\u533A" }), _jsx("strong", { children: coveredRegions })] })] })] }), _jsx("section", { className: "railPanel", children: _jsxs("label", { className: "railSearchField", children: [_jsx(MagnifyingGlass, { size: 16 }), _jsx("input", { readOnly: true, value: search, "aria-label": "\u5DE6\u4FA7\u641C\u7D22\u7ED3\u679C\u540C\u6B65", placeholder: "\u641C\u7D22\u516C\u53F8\u6216\u4F9B\u5E94\u5546" })] }) }), _jsxs("section", { className: "railPanel searchResultsPanel", children: [_jsxs("div", { className: "railSectionHeader", children: [_jsxs("strong", { children: ["\u641C\u7D22\u7ED3\u679C (", searchResults.length, ")"] }), _jsx("span", { children: search ? `关键词：${search}` : "图谱定位列表" })] }), _jsx("div", { className: "searchResultsList", children: searchResults.slice(0, 8).map((company) => {
                            const isActive = company.id === activeCompanyId;
                            return (_jsxs("button", { className: isActive ? "searchResultRow active" : "searchResultRow", onClick: () => onCompanySelect(company.id), type: "button", children: [_jsx("div", { className: "searchResultAvatar", children: company.ticker.slice(0, 1) }), _jsxs("div", { className: "searchResultContent", children: [_jsx("strong", { children: company.displayName }), _jsx("span", { children: company.canonicalName }), _jsx("small", { children: company.aliasHitExplanation ?? company.hierarchySummary })] }), _jsx(TrendUp, { size: 16, weight: isActive ? "fill" : "regular" })] }, company.id));
                        }) }), _jsx("button", { className: "viewAllButton", type: "button", children: "\u67E5\u770B\u5168\u90E8\u7ED3\u679C" })] })] }));
}
function formatMarketCap(value) {
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
