import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Buildings, ChartBar, Database, LinkBreak, Path, Stack } from "@phosphor-icons/react";
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
    const { activeNode, activeRelation, activeTab, company, evidence, evidenceError, evidenceLoading, evidenceSummary, isOpen, onClose, onRelationSelect, onRetryEvidence, onTabChange, relations, } = props;
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
    return (_jsxs("aside", { className: "detailSidebar", "aria-hidden": !isOpen, children: [_jsxs("div", { className: "detailSidebarHeader", children: [_jsxs("div", { className: "detailCompany", children: [_jsx("div", { className: "detailLogo", children: company.ticker.slice(0, 2) }), _jsxs("div", { children: [_jsx("p", { className: "sectionEyebrow compact", children: company.ticker || company.canonicalName }), _jsx("h3", { children: company.displayName }), _jsx("p", { children: company.canonicalName }), company.aliasHitExplanation ? _jsx("p", { children: company.aliasHitExplanation }) : null, _jsx("span", { className: "tierBadge", children: "Tier 1 suppliers" })] })] }), _jsx("button", { className: "closeSidebar", type: "button", "aria-label": "Close details panel", onClick: onClose, children: "\u00D7" })] }), _jsxs("div", { className: "detailTabs", role: "tablist", "aria-label": "Company detail tabs", children: [_jsx("button", { "aria-controls": overviewPanelId, "aria-selected": activeTab === "overview", className: activeTab === "overview" ? "tabButton active" : "tabButton", id: overviewTabId, onClick: () => onTabChange("overview"), onKeyDown: (event) => handleTabKeyDown(event, "overview"), ref: (node) => {
                            tabRefs.current.overview = node;
                        }, role: "tab", tabIndex: activeTab === "overview" ? 0 : -1, type: "button", children: "Overview" }), _jsx("button", { "aria-controls": evidencePanelId, "aria-selected": activeTab === "evidence", className: activeTab === "evidence" ? "tabButton active" : "tabButton", id: evidenceTabId, onClick: () => onTabChange("evidence"), onKeyDown: (event) => handleTabKeyDown(event, "evidence"), ref: (node) => {
                            tabRefs.current.evidence = node;
                        }, role: "tab", tabIndex: activeTab === "evidence" ? 0 : -1, type: "button", children: "Evidence" }), _jsx("button", { "aria-controls": financialsPanelId, "aria-selected": activeTab === "financials", className: activeTab === "financials" ? "tabButton active" : "tabButton", id: financialsTabId, onClick: () => onTabChange("financials"), onKeyDown: (event) => handleTabKeyDown(event, "financials"), ref: (node) => {
                            tabRefs.current.financials = node;
                        }, role: "tab", tabIndex: activeTab === "financials" ? 0 : -1, type: "button", children: "Financials" })] }), _jsxs("div", { className: "evidenceKpis", children: [_jsx(Metric, { label: "Confirmed", value: `${evidenceSummary.confirmed}` }), _jsx(Metric, { label: "Strong evidence", value: `${evidenceSummary.strongEvidence}` }), _jsx(Metric, { label: "Inferred", value: `${evidenceSummary.inferred}` })] }), _jsxs("div", { className: "detailPanelBody", children: [activeTab === "overview" ? (_jsxs("div", { "aria-labelledby": overviewTabId, id: overviewPanelId, role: "tabpanel", children: [_jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Current focus" }), _jsx("strong", { children: activeNode?.displayName ?? company.displayName }), _jsx("p", { children: activeNode ? `${activeNode.kindLabel} in ${activeNode.region}` : company.summary }), _jsx("p", { children: activeNode?.hierarchySummary ?? company.hierarchySummary })] }), activeRelation ? (_jsxs("div", { className: "detailCard relationContextCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Selected relationship" }), _jsx("strong", { children: activeRelation.relationshipSemanticLabel }), _jsxs("div", { className: "metaGrid", children: [_jsx("span", { children: "Type" }), _jsx("strong", { children: activeRelation.relationshipTypeLabel }), _jsx("span", { children: "Subtype" }), _jsx("strong", { children: activeRelation.relationshipSubtypeLabel ?? "Not specified" }), _jsx("span", { children: "Source method" }), _jsx("strong", { children: activeRelation.sourceMethodLabel ?? "Not specified" }), _jsx("span", { children: "Evidence precision" }), _jsx("strong", { children: activeRelation.evidenceDateResolutionLabel ?? "Not specified" }), _jsx("span", { children: "Valid from" }), _jsx("strong", { children: activeRelation.validFrom
                                                    ? `${activeRelation.validFrom} (${activeRelation.validFromResolutionLabel ?? "Unspecified resolution"})`
                                                    : "Not specified" }), _jsx("span", { children: "Valid to" }), _jsx("strong", { children: activeRelation.validTo
                                                    ? `${activeRelation.validTo} (${activeRelation.validToResolutionLabel ?? "Unspecified resolution"})`
                                                    : "Open" }), _jsx("span", { children: "Validity" }), _jsx("strong", { children: activeRelation.validityLabel }), _jsx("span", { children: "Validity note" }), _jsx("strong", { children: activeRelation.validityNote ?? "No additional note" })] })] })) : null, _jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Entity layers" }), _jsx("strong", { children: "Group / brand / legal entity / facility" }), _jsx("p", { children: company.hierarchySummary }), _jsxs("ul", { className: "detailList", children: [_jsxs("li", { children: ["Group: ", company.canonicalName] }), _jsxs("li", { children: ["Display: ", company.displayName] }), _jsxs("li", { children: ["Legal entities: ", company.entityProfile?.legalEntities.map((item) => item.name).join(", ") || "No legal entity aliases in payload"] }), _jsxs("li", { children: ["Brands: ", company.entityProfile?.brands.map((item) => item.name).join(", ") || "No brand aliases in payload"] }), _jsxs("li", { children: ["Facilities:", " ", company.entityProfile?.aliases.filter((item) => item.aliasType === "facility").map((item) => item.name).join(", ") ||
                                                        "Facility nodes stay separate in the graph when available"] })] })] }), _jsxs("div", { className: "detailMetricGrid", children: [_jsx(MetricCard, { icon: _jsx(Buildings, { size: 18 }), label: "Primary region", value: company.primaryRegion }), _jsx(MetricCard, { icon: _jsx(ChartBar, { size: 18 }), label: "Market cap", value: formatCurrency(company.marketCapUsd) }), _jsx(MetricCard, { icon: _jsx(Stack, { size: 18 }), label: "Relations", value: `${company.overview.relationCount}` }), _jsx(MetricCard, { icon: _jsx(Database, { size: 18 }), label: "Critical deps", value: `${company.overview.criticalDependencyCount}` })] }), _jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Relationship picks" }), _jsx("div", { className: "relationList", children: relations.slice(0, 4).map((relation) => (_jsxs("button", { className: relation.id === activeRelation?.id ? "sidebarRelation active" : "sidebarRelation", onClick: () => onRelationSelect(relation), type: "button", children: [_jsxs("span", { className: "miniBadge", children: [_jsx(Path, { size: 12 }), "Tier ", relation.tier] }), _jsx("span", { className: "miniBadge semantic", children: relation.relationshipTypeLabel }), _jsx("strong", { children: relation.summary }), _jsx("p", { children: relation.relationshipSemanticLabel }), _jsx("p", { children: relation.relationshipSubtypeLabel ?? "Subtype not specified" })] }, relation.id))) })] }), _jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "API boundary" }), _jsxs("ul", { className: "detailList", children: [_jsx("li", { children: graphApiContract.companies }), _jsx("li", { children: company.apiBindings.companyEndpoint }), _jsx("li", { children: company.apiBindings.overviewEndpoint }), _jsx("li", { children: company.apiBindings.graphEndpoint }), _jsx("li", { children: graphApiContract.evidence }), _jsxs("li", { children: [_jsx(LinkBreak, { size: 14 }), " Graph container and detail tabs consume typed DTOs only."] })] })] })] })) : null, activeTab === "evidence" ? (_jsx("div", { "aria-labelledby": evidenceTabId, id: evidencePanelId, role: "tabpanel", children: _jsx(EvidencePanel, { evidence: evidence, error: evidenceError, loading: evidenceLoading, onRetry: onRetryEvidence, relation: activeRelation }) })) : null, activeTab === "financials" ? (_jsxs("div", { "aria-labelledby": financialsTabId, id: financialsPanelId, role: "tabpanel", children: [_jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Financials" }), _jsx("strong", { children: formatCurrency(company.marketCapUsd) }), _jsx("p", { children: "Node sizing is prepared to reflect market capitalization and relative ecosystem importance." })] }), _jsxs("div", { className: "detailCard", children: [_jsx("p", { className: "sectionEyebrow compact", children: "Data contract" }), _jsxs("ul", { className: "detailList", children: [_jsxs("li", { children: ["Overview: ", company.apiBindings.overviewEndpoint] }), _jsxs("li", { children: ["Graph: ", company.apiBindings.graphEndpoint] }), _jsxs("li", { children: ["Evidence: ", company.apiBindings.evidenceEndpoint] })] })] })] })) : null] })] }));
}
function Metric(props) {
    return (_jsxs("div", { className: "evidenceMetric", children: [_jsx("span", { children: props.label }), _jsx("strong", { children: props.value })] }));
}
function MetricCard(props) {
    return (_jsxs("div", { className: "metricCard overlay", children: [_jsx("div", { className: "metricIcon", children: props.icon }), _jsxs("div", { children: [_jsx("span", { children: props.label }), _jsx("strong", { children: props.value })] })] }));
}
function formatCurrency(value) {
    if (value === null) {
        return "N/A";
    }
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
        style: "currency",
        currency: "USD",
    }).format(value);
}
