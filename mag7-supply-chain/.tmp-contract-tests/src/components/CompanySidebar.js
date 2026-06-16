import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChartBar, GlobeHemisphereWest, LinkBreak, Path, Rows, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { EvidencePanel } from "./EvidencePanel.js";
import { graphApiContract } from "../services/graphExplorerApi.js";
export const companySidebarTabOrder = ["overview", "evidence", "financials"];
export function getNextCompanySidebarTab(currentTab, key) {
    if (key !== "ArrowLeft" && key !== "ArrowRight") {
        return null;
    }
    const currentIndex = companySidebarTabOrder.indexOf(currentTab);
    const direction = key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + companySidebarTabOrder.length) % companySidebarTabOrder.length;
    return companySidebarTabOrder[nextIndex];
}
export function CompanySidebar(props) {
    const { activeNode, activeRelation, activeTab, company, depth = 3, evidence, evidenceError, evidenceLoading, evidenceSummary, isOpen = true, onClose = () => undefined, onRelationSelect, onRetryEvidence = () => undefined, onTabChange, relations, } = props;
    const overviewTabId = "company-tab-overview";
    const evidenceTabId = "company-tab-evidence";
    const financialsTabId = "company-tab-financials";
    const overviewPanelId = "company-panel-overview";
    const evidencePanelId = "company-panel-evidence";
    const financialsPanelId = "company-panel-financials";
    const tabRefs = useRef({
        overview: null,
        evidence: null,
        financials: null,
    });
    const pendingFocusTabRef = useRef(null);
    useEffect(() => {
        if (pendingFocusTabRef.current !== activeTab) {
            return;
        }
        tabRefs.current[activeTab]?.focus();
        pendingFocusTabRef.current = null;
    }, [activeTab]);
    function handleTabKeyDown(event, tab) {
        const nextTab = getNextCompanySidebarTab(tab, event.key);
        if (!nextTab) {
            return;
        }
        event.preventDefault();
        pendingFocusTabRef.current = nextTab;
        onTabChange(nextTab);
    }
    return (_jsxs("aside", { className: isOpen ? "evidenceSidebar isOpen" : "evidenceSidebar", "aria-hidden": !isOpen, children: [_jsxs("div", { className: "evidenceSidebarHeader", children: [_jsxs("div", { className: "evidenceSidebarCompany", children: [_jsx("div", { className: "evidenceSidebarLogo", children: company.ticker.slice(0, 1) }), _jsxs("div", { children: [_jsx("h3", { children: company.displayName }), _jsx("p", { children: "\u7126\u70B9\u516C\u53F8" }), _jsx("span", { children: company.canonicalName })] })] }), _jsx("button", { "aria-label": "\u5173\u95ED\u8BC1\u636E\u4FA7\u680F", className: "closeSidebar", onClick: onClose, type: "button", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "detailTabs", role: "tablist", "aria-label": "\u516C\u53F8\u8BE6\u60C5\u6807\u7B7E", children: [_jsx("button", { "aria-controls": overviewPanelId, "aria-selected": activeTab === "overview", className: activeTab === "overview" ? "tabButton active" : "tabButton", id: overviewTabId, onClick: () => onTabChange("overview"), onKeyDown: (event) => handleTabKeyDown(event, "overview"), ref: (node) => {
                            tabRefs.current.overview = node;
                        }, role: "tab", tabIndex: activeTab === "overview" ? 0 : -1, type: "button", children: "Overview" }), _jsx("button", { "aria-controls": evidencePanelId, "aria-selected": activeTab === "evidence", className: activeTab === "evidence" ? "tabButton active" : "tabButton", id: evidenceTabId, onClick: () => onTabChange("evidence"), onKeyDown: (event) => handleTabKeyDown(event, "evidence"), ref: (node) => {
                            tabRefs.current.evidence = node;
                        }, role: "tab", tabIndex: activeTab === "evidence" ? 0 : -1, type: "button", children: "Evidence" }), _jsx("button", { "aria-controls": financialsPanelId, "aria-selected": activeTab === "financials", className: activeTab === "financials" ? "tabButton active" : "tabButton", id: financialsTabId, onClick: () => onTabChange("financials"), onKeyDown: (event) => handleTabKeyDown(event, "financials"), ref: (node) => {
                            tabRefs.current.financials = node;
                        }, role: "tab", tabIndex: activeTab === "financials" ? 0 : -1, type: "button", children: "Financials" })] }), _jsxs("div", { className: "evidenceKpis", children: [_jsx(Metric, { label: "\u5DF2\u786E\u8BA4", value: `${evidenceSummary.confirmed}`, tone: "confirmed" }), _jsx(Metric, { label: "\u5F3A\u8BC1\u636E", value: `${evidenceSummary.strongEvidence}`, tone: "strong" }), _jsx(Metric, { label: "\u63A8\u65AD", value: `${evidenceSummary.inferred}`, tone: "inferred" })] }), _jsxs("div", { className: "evidenceSidebarBody", children: [activeTab === "overview" ? (_jsxs("div", { "aria-labelledby": overviewTabId, id: overviewPanelId, role: "tabpanel", children: [_jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u516C\u53F8\u951A\u70B9" }), _jsx("strong", { children: activeNode?.displayName ?? company.displayName }), _jsx("p", { children: company.summary })] }), _jsxs("div", { className: "sidebarMetricsGrid", children: [_jsx(MetricCard, { icon: _jsx(ChartBar, { size: 16 }), label: "\u5E02\u503C", value: formatCurrency(company.marketCapUsd) }), _jsx(MetricCard, { icon: _jsx(Rows, { size: 16 }), label: "\u5173\u7CFB\u6570", value: `${company.overview.relationCount}` }), _jsx(MetricCard, { icon: _jsx(GlobeHemisphereWest, { size: 16 }), label: "\u533A\u57DF", value: company.primaryRegion }), _jsx(MetricCard, { icon: _jsx(Path, { size: 16 }), label: "\u7A7F\u900F\u5C42\u7EA7", value: `${depth}级` })] }), activeRelation ? (_jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u5F53\u524D\u5173\u7CFB" }), _jsx("strong", { children: activeRelation.relationshipSemanticLabel }), _jsxs("dl", { className: "auditGrid compact", children: [_jsx("dt", { children: "\u5173\u7CFB\u7C7B\u578B" }), _jsx("dd", { children: activeRelation.relationshipTypeLabel }), _jsx("dt", { children: "\u5B50\u7C7B\u578B" }), _jsx("dd", { children: activeRelation.relationshipSubtypeLabel ?? "未标注" }), _jsx("dt", { children: "\u6765\u6E90\u65B9\u6CD5" }), _jsx("dd", { children: activeRelation.sourceMethodLabel ?? "未标注" }), _jsx("dt", { children: "\u65F6\u95F4\u7C92\u5EA6" }), _jsx("dd", { children: activeRelation.evidenceDateResolutionLabel ?? "未标注" }), _jsx("dt", { children: "\u6709\u6548\u671F" }), _jsx("dd", { children: activeRelation.validityLabel })] })] })) : null, _jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u91CD\u70B9\u5173\u7CFB" }), _jsx("div", { className: "sidebarRelationList", children: relations.slice(0, 4).map((relation) => (_jsxs("button", { className: relation.id === activeRelation?.id ? "sidebarRelation active" : "sidebarRelation", onClick: () => onRelationSelect(relation), type: "button", children: [_jsx("span", { children: relation.relationshipTypeLabel }), _jsx("strong", { children: relation.summary }), _jsx("small", { children: relation.relationshipSubtypeLabel ?? relation.relationshipSemanticLabel })] }, relation.id))) })] }), _jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u5B9E\u4F53\u5C42\u7EA7" }), _jsx("strong", { children: "Group / brand / legal entity / facility" }), _jsx("p", { children: company.hierarchySummary }), _jsxs("ul", { className: "detailList", children: [_jsxs("li", { children: ["Group: ", company.canonicalName] }), _jsxs("li", { children: ["Display: ", company.displayName] }), _jsxs("li", { children: ["Legal entities: ", company.entityProfile?.legalEntities.map((item) => item.name).join(", ") || "No legal entity aliases"] }), _jsxs("li", { children: ["Brands: ", company.entityProfile?.brands.map((item) => item.name).join(", ") || "No brand aliases"] }), _jsxs("li", { children: ["Facilities:", " ", company.entityProfile?.aliases.filter((item) => item.aliasType === "facility").map((item) => item.name).join(", ") ||
                                                        "Facility nodes stay separate in the graph"] })] }), company.aliasHitExplanation ? _jsx("p", { children: company.aliasHitExplanation }) : null] }), _jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "API \u8FB9\u754C" }), _jsxs("ul", { className: "detailList", children: [_jsx("li", { children: graphApiContract.companies }), _jsx("li", { children: company.apiBindings.companyEndpoint }), _jsx("li", { children: company.apiBindings.graphEndpoint }), _jsx("li", { children: company.apiBindings.evidenceEndpoint }), _jsxs("li", { children: [_jsx(LinkBreak, { size: 14 }), " \u4FA7\u680F\u7EE7\u7EED\u6D88\u8D39 typed DTO \u4E0E view-model \u9002\u914D\u5C42\u3002"] })] })] })] })) : null, activeTab === "evidence" ? (_jsx("div", { "aria-labelledby": evidenceTabId, id: evidencePanelId, role: "tabpanel", children: _jsx(EvidencePanel, { evidence: evidence, error: evidenceError, loading: evidenceLoading, onRetry: onRetryEvidence, relation: activeRelation }) })) : null, activeTab === "financials" ? (_jsxs("div", { "aria-labelledby": financialsTabId, id: financialsPanelId, role: "tabpanel", children: [_jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u8D22\u52A1\u6458\u8981" }), _jsx("strong", { children: formatCurrency(company.marketCapUsd) }), _jsx("p", { children: "\u8282\u70B9\u5927\u5C0F\u6301\u7EED\u7ED1\u5B9A\u5E02\u503C\u4E0E\u751F\u6001\u91CD\u8981\u6027\uFF0C\u540E\u7EED\u53EF\u63A5\u5165\u91C7\u8D2D\u66B4\u9732\u5EA6\u4E0E\u96C6\u4E2D\u5EA6\u6307\u6807\u3002" })] }), _jsxs("div", { className: "sidebarCard", children: [_jsx("p", { className: "sidebarSectionLabel", children: "\u9884\u7559\u6307\u6807" }), _jsxs("dl", { className: "auditGrid compact", children: [_jsx("dt", { children: "\u4F9B\u5E94\u5546\u603B\u91CF" }), _jsx("dd", { children: company.overview.supplierCount }), _jsx("dt", { children: "\u4E00\u7EA7\u4F9B\u5E94\u5546" }), _jsx("dd", { children: company.overview.tier1SupplierCount }), _jsx("dt", { children: "\u8BC1\u636E\u8986\u76D6" }), _jsxs("dd", { children: [Math.round(company.overview.evidenceCoverage * 100), "%"] }), _jsx("dt", { children: "\u9AD8\u98CE\u9669\u4F9D\u8D56" }), _jsx("dd", { children: company.overview.criticalDependencyCount })] })] })] })) : null] })] }));
}
function Metric(props) {
    return (_jsxs("div", { className: `evidenceMetric ${props.tone}`, children: [_jsx("span", { children: props.label }), _jsx("strong", { children: props.value })] }));
}
function MetricCard(props) {
    return (_jsxs("div", { className: "sidebarMetricCard", children: [_jsx("div", { className: "sidebarMetricIcon", children: props.icon }), _jsx("span", { children: props.label }), _jsx("strong", { children: props.value })] }));
}
function formatCurrency(value) {
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
