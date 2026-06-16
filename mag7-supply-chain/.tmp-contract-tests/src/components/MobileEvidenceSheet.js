import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef } from "react";
import { EvidencePanel } from "./EvidencePanel";
export function MobileEvidenceSheet(props) {
    const { activeNode, activeRelation, activeTab, company, depth, evidence, evidenceError, evidenceLoading, evidenceSummary, isMobileViewport, isExpanded, isOpen, onExpand, onClose, onOpen, onRetryEvidence, onTabChange, triggerRef, } = props;
    const titleId = useId();
    const overviewTabId = useId();
    const evidenceTabId = useId();
    const financialsTabId = useId();
    const closeButtonRef = useRef(null);
    const panelTabOrder = ["overview", "evidence", "financials"];
    useEffect(() => {
        if (!isMobileViewport || !isOpen) {
            return;
        }
        closeButtonRef.current?.focus();
    }, [isMobileViewport, isOpen]);
    function getNextTab(currentTab, key) {
        if (key !== "ArrowLeft" && key !== "ArrowRight") {
            return null;
        }
        const currentIndex = panelTabOrder.indexOf(currentTab);
        const direction = key === "ArrowRight" ? 1 : -1;
        return panelTabOrder[(currentIndex + direction + panelTabOrder.length) % panelTabOrder.length];
    }
    function handleTabKeyDown(event, currentTab) {
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
    return (_jsxs("section", { className: isOpen ? "mobileEvidenceShell isOpen" : "mobileEvidenceShell", "aria-label": "\u79FB\u52A8\u7AEF\u8BC1\u636E\u62BD\u5C49", children: [_jsx("button", { "aria-expanded": isOpen, "aria-controls": "mobile-evidence-sheet", className: isOpen ? "mobileSheetPeek isHidden" : "mobileSheetPeek", onClick: onOpen, ref: triggerRef, type: "button", children: "\u67E5\u770B\u6982\u89C8\u3001\u8BC1\u636E\u4E0E\u8D22\u52A1" }), _jsxs("div", { "aria-labelledby": titleId, className: isExpanded ? "mobileBottomSheet isExpanded" : "mobileBottomSheet", id: "mobile-evidence-sheet", onKeyDown: (event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        onClose();
                    }
                }, role: "dialog", "aria-modal": "false", children: [_jsxs("div", { className: "mobileSheetControls", children: [_jsx("button", { "aria-label": isExpanded ? "收起证据抽屉" : "展开证据抽屉", className: "mobileSheetHandleButton", onClick: () => onExpand(!isExpanded), type: "button", children: _jsx("span", { className: "mobileSheetHandle" }) }), _jsx("button", { "aria-label": "\u5173\u95ED\u79FB\u52A8\u7AEF\u8BC1\u636E\u62BD\u5C49", className: "mobileSheetClose", onClick: onClose, ref: closeButtonRef, type: "button", children: "\u6536\u8D77" })] }), _jsxs("div", { className: "mobileSheetSurface", children: [_jsxs("div", { className: "mobileSheetHeader", children: [_jsx("strong", { id: titleId, children: "\u6765\u6E90\u8BC1\u636E" }), _jsxs("span", { children: [company.displayName, " / ", depth, "\u7EA7\u7A7F\u900F"] })] }), _jsxs("div", { className: "mobileTabs", role: "tablist", "aria-label": "\u79FB\u52A8\u7AEF\u8BE6\u60C5\u6807\u7B7E", children: [_jsx("button", { "aria-controls": "mobile-panel-overview", "aria-selected": activeTab === "overview", className: activeTab === "overview" ? "mobileTab active" : "mobileTab", id: overviewTabId, onClick: () => onTabChange("overview"), onKeyDown: (event) => handleTabKeyDown(event, "overview"), role: "tab", tabIndex: activeTab === "overview" ? 0 : -1, type: "button", children: "\u6982\u89C8" }), _jsx("button", { "aria-controls": "mobile-panel-evidence", "aria-selected": activeTab === "evidence", className: activeTab === "evidence" ? "mobileTab active" : "mobileTab", id: evidenceTabId, onClick: () => onTabChange("evidence"), onKeyDown: (event) => handleTabKeyDown(event, "evidence"), role: "tab", tabIndex: activeTab === "evidence" ? 0 : -1, type: "button", children: "\u8BC1\u636E" }), _jsx("button", { "aria-controls": "mobile-panel-financials", "aria-selected": activeTab === "financials", className: activeTab === "financials" ? "mobileTab active" : "mobileTab", id: financialsTabId, onClick: () => onTabChange("financials"), onKeyDown: (event) => handleTabKeyDown(event, "financials"), role: "tab", tabIndex: activeTab === "financials" ? 0 : -1, type: "button", children: "\u8D22\u52A1" })] }), _jsxs("div", { className: "mobileEvidenceKpis", children: [_jsx(Metric, { label: "\u5DF2\u786E\u8BA4", value: evidenceSummary.confirmed }), _jsx(Metric, { label: "\u5F3A\u8BC1\u636E", value: evidenceSummary.strongEvidence }), _jsx(Metric, { label: "\u63A8\u65AD", value: evidenceSummary.inferred })] }), _jsx("div", { className: "mobileEvidenceBody", children: activeTab === "evidence" ? (_jsx("div", { "aria-labelledby": evidenceTabId, id: "mobile-panel-evidence", role: "tabpanel", children: _jsx(EvidencePanel, { evidence: evidence, error: evidenceError, loading: evidenceLoading, onRetry: onRetryEvidence, relation: activeRelation }) })) : (_jsxs("article", { "aria-labelledby": activeTab === "overview" ? overviewTabId : financialsTabId, className: "mobileSummaryCard", id: activeTab === "overview" ? "mobile-panel-overview" : "mobile-panel-financials", role: "tabpanel", children: [_jsx("strong", { children: activeTab === "overview" ? "图谱概览" : "财务摘要" }), activeTab === "overview" ? (_jsxs(_Fragment, { children: [_jsx("p", { children: activeNode?.displayName ?? company.displayName }), _jsx("p", { children: "\u5F53\u524D\u7126\u70B9\u8282\u70B9\u4E0E\u684C\u9762\u4FA7\u680F\u5171\u4EAB\u540C\u4E00\u5957\u6982\u89C8\u3001\u8BC1\u636E\u4E0E\u8D22\u52A1\u4E0A\u4E0B\u6587\u3002" })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["\u5E02\u503C\uFF1A", formatMarketCap(company.marketCapUsd)] }), _jsxs("p", { children: ["\u4F9B\u5E94\u5546\u603B\u91CF ", company.overview.supplierCount, "\uFF0C\u4E00\u7EA7\u4F9B\u5E94\u5546 ", company.overview.tier1SupplierCount, "\u3002"] })] })), activeRelation ? _jsxs("p", { children: ["\u5F53\u524D\u5173\u7CFB\uFF1A", activeRelation.summary] }) : null] })) })] })] })] }));
}
function Metric(props) {
    return (_jsxs("div", { className: "mobileMetric", children: [_jsx("span", { children: props.label }), _jsx("strong", { children: props.value })] }));
}
function formatMarketCap(value) {
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
