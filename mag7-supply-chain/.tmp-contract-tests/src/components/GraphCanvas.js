import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowsOutSimple, Minus, Plus, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { getRelationshipTypeLabel } from "../utils/relationSemantics.js";
export function GraphCanvas(props) {
    const { activeNodeId, activeRelationId, depth = 3, focusNode, graph, isFullscreen = false, onFullscreenToggle = () => undefined, onNodeSelect, onRelationSelect, onZoomChange, zoom, } = props;
    const instructionsId = useId();
    const keyboardPanelId = useId();
    const visibleNodes = graph.nodes.length;
    const visibleRelations = graph.relations.length;
    const expansionHint = graph.relations.find((relation) => relation.confidence === "strong_evidence") ?? graph.relations[0] ?? null;
    const [keyboardExplorerOpen, setKeyboardExplorerOpen] = useState(false);
    const assistCloseButtonRef = useRef(null);
    useEffect(() => {
        if (!keyboardExplorerOpen) {
            return;
        }
        assistCloseButtonRef.current?.focus();
    }, [keyboardExplorerOpen]);
    return (_jsx("section", { className: "graphWorkspace", children: _jsxs("div", { className: "graphViewport", "aria-describedby": instructionsId, children: [_jsx("div", { className: "graphViewportTextures", "aria-hidden": "true" }), _jsxs("div", { className: "graphStatsCluster", children: [_jsxs("div", { className: "graphStatCard", children: [_jsx("span", { children: "\u53EF\u89C6\u8282\u70B9" }), _jsx("strong", { children: visibleNodes })] }), _jsxs("div", { className: "graphStatCard", children: [_jsx("span", { children: "\u5173\u7CFB" }), _jsx("strong", { children: visibleRelations })] })] }), _jsxs("div", { className: "graphCanvasControls", children: [_jsx("button", { "aria-controls": keyboardPanelId, "aria-expanded": keyboardExplorerOpen, "aria-label": keyboardExplorerOpen ? "关闭键盘探索面板" : "打开键盘探索面板", className: "graphControlButton graphControlLabel", onClick: () => setKeyboardExplorerOpen((current) => !current), type: "button", children: keyboardExplorerOpen ? "关闭探索" : "键盘探索" }), _jsx("button", { "aria-label": "\u7F29\u5C0F\u56FE\u8C31", className: "graphControlButton", onClick: () => onZoomChange(Math.max(0.82, zoom - 0.1)), type: "button", children: _jsx(Minus, { size: 16 }) }), _jsx("button", { "aria-label": "\u653E\u5927\u56FE\u8C31", className: "graphControlButton", onClick: () => onZoomChange(Math.min(1.5, zoom + 0.1)), type: "button", children: _jsx(Plus, { size: 16 }) }), _jsx("button", { "aria-label": isFullscreen ? "退出全屏探索" : "进入全屏探索", "aria-pressed": isFullscreen, className: "graphControlButton", onClick: onFullscreenToggle, type: "button", children: _jsx(ArrowsOutSimple, { size: 16 }) })] }), _jsx("div", { className: "graphExpansionHint", children: expansionHint ? `展开中... ${expansionHint.summary}` : "展开中..." }), _jsx("p", { className: "srOnly", id: instructionsId, children: "\u4F7F\u7528\u56FE\u8C31\u63A7\u5236\u6309\u94AE\u6216\u952E\u76D8\u63A2\u7D22\u9762\u677F\u8FDB\u884C\u63A2\u7D22\u3002\u9009\u62E9\u8282\u70B9\u53EF\u5237\u65B0\u6982\u89C8\uFF0C\u9009\u62E9\u5173\u7CFB\u53EF\u6253\u5F00\u8BC1\u636E\u4E0E\u5BA1\u8BA1\u4FE1\u606F\u3002" }), _jsx("div", { "aria-hidden": "true", className: "legacyCompatibilityCopy", children: "group anchors, brand/legal naming, and facility operators" }), _jsxs("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 100 100", children: [_jsx("defs", { children: _jsxs("radialGradient", { id: "focusGlow", cx: "50%", cy: "50%", r: "60%", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(255,107,87,0.95)" }), _jsx("stop", { offset: "55%", stopColor: "rgba(255,107,87,0.18)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(255,107,87,0)" })] }) }), _jsxs("g", { transform: `scale(${zoom}) translate(${(1 - zoom) * 50} ${(1 - zoom) * 50})`, children: [graph.relations.map((relation) => {
                                    const source = graph.nodes.find((node) => node.id === relation.sourceId);
                                    const target = graph.nodes.find((node) => node.id === relation.targetId);
                                    if (!source || !target) {
                                        return null;
                                    }
                                    const isActive = relation.id === activeRelationId;
                                    const isDimmed = !isActive && activeRelationId !== null;
                                    return (_jsxs("g", { children: [_jsx("path", { className: isActive ? "graphEdge active" : isDimmed ? "graphEdge dimmed" : "graphEdge", d: curvePath(source, target), onClick: () => onRelationSelect(relation), style: { ["--edge-color"]: getEdgeColor(relation.relationshipType) } }), _jsx("text", { className: "graphEdgeLabel", x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 - 1.2, children: getRelationshipTypeLabel(relation.relationshipType) })] }, relation.id));
                                }), graph.nodes.map((node) => {
                                    const radius = getNodeRadius(node);
                                    const isActive = node.id === activeNodeId;
                                    const isFocus = node.id === focusNode.id;
                                    return (_jsxs("g", { className: isActive ? "graphNode active" : isFocus ? "graphNode focus" : "graphNode", onClick: () => onNodeSelect(node), transform: `translate(${node.x} ${node.y})`, children: [isFocus ? _jsx("circle", { className: "graphNodeGlow", r: radius + 4.6 }) : null, _jsx("circle", { className: "graphNodeRing", r: radius + 1.2, style: { ["--ring-color"]: getTierColor(node, depth) } }), _jsx("circle", { className: "graphNodeCore", r: radius, style: { ["--node-fill"]: getNodeFill(node, isFocus) } }), _jsx("text", { y: radius + 4.2, children: node.label })] }, node.id));
                                })] })] }), _jsxs("div", { className: "collapsedClusterBadge", children: [_jsx("span", { children: "\u5DF2\u6298\u53E0" }), _jsx("strong", { children: "18 \u4E2A\u8282\u70B9" })] }), _jsxs("div", { className: "miniMapCard", children: [_jsxs("div", { className: "miniMapCardHeader", children: [_jsx("strong", { children: "\u5168\u5C40\u7F29\u7565\u56FE" }), _jsx("span", { children: graph.focusCompany.displayName })] }), _jsx("div", { className: "miniMapFrame", children: graph.nodes.slice(0, 28).map((node) => (_jsx("i", { style: { left: `${node.x}%`, top: `${node.y}%` } }, node.id))) })] }), keyboardExplorerOpen ? (_jsxs("div", { "aria-label": "\u5B8C\u6574\u952E\u76D8\u63A2\u7D22\u9762\u677F", className: "graphExplorerAssist", id: keyboardPanelId, onKeyDown: (event) => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            setKeyboardExplorerOpen(false);
                        }
                    }, role: "dialog", children: [_jsxs("div", { className: "graphExplorerAssistHeader", children: [_jsxs("div", { children: [_jsx("strong", { children: "\u952E\u76D8\u63A2\u7D22\u8DEF\u5F84" }), _jsxs("span", { children: ["\u5B8C\u6574\u66B4\u9732\u5168\u90E8 ", graph.nodes.length, " \u4E2A\u8282\u70B9\u4E0E ", graph.relations.length, " \u6761\u5173\u7CFB\uFF0C\u4E0D\u622A\u65AD\u6837\u672C\u3002"] })] }), _jsx("button", { "aria-label": "\u5173\u95ED\u952E\u76D8\u63A2\u7D22\u9762\u677F", className: "graphAssistClose", onClick: () => setKeyboardExplorerOpen(false), ref: assistCloseButtonRef, type: "button", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "graphExplorerAssistGrid", children: [_jsxs("div", { className: "graphKeyboardPanel", children: [_jsxs("div", { className: "graphKeyboardHeader", children: [_jsx("strong", { children: "\u5168\u90E8\u8282\u70B9" }), _jsx("span", { children: graph.nodes.length })] }), _jsx("div", { className: "graphKeyboardList", children: graph.nodes.map((node) => {
                                                const isActive = node.id === activeNodeId;
                                                return (_jsxs("button", { "aria-label": `${node.displayName}，${node.kindLabel}，${node.region}`, "aria-pressed": isActive, className: isActive ? "graphListButton active" : "graphListButton", onClick: () => onNodeSelect(node), type: "button", children: [_jsx("span", { children: node.kindLabel }), _jsx("strong", { children: node.displayName }), _jsx("small", { children: node.secondaryLabel || node.region })] }, node.id));
                                            }) })] }), _jsxs("div", { className: "graphKeyboardPanel relationPanel", children: [_jsxs("div", { className: "graphKeyboardHeader", children: [_jsx("strong", { children: "\u5168\u90E8\u5173\u7CFB" }), _jsx("span", { children: graph.relations.length })] }), _jsx("div", { className: "graphKeyboardList relationList", children: graph.relations.map((relation) => {
                                                const isActive = relation.id === activeRelationId;
                                                return (_jsxs("button", { "aria-label": `${relation.summary}，${relation.relationshipTypeLabel}，${relation.tier}级`, "aria-pressed": isActive, className: isActive ? "graphListButton active" : "graphListButton", onClick: () => onRelationSelect(relation), type: "button", children: [_jsxs("span", { children: [relation.relationshipTypeLabel, " / ", relation.tier, "\u7EA7"] }), _jsx("strong", { children: relation.summary }), _jsx("small", { children: relation.relationshipSubtypeLabel ?? relation.relationshipSemanticLabel })] }, relation.id));
                                            }) })] })] })] })) : null, _jsxs("div", { className: "focusBreadcrumb", children: ["\u7126\u70B9\u8DEF\u5F84: ", graph.focusCompany.displayName, " \u2192 \u4F9B\u5E94\u94FE\u7F51\u7EDC \u2192 \u5168\u7403\u89C6\u56FE (", depth, "\u7EA7\u7A7F\u900F)"] })] }) }));
}
function curvePath(source, target) {
    const controlX = (source.x + target.x) / 2;
    const controlY = Math.min(source.y, target.y) - Math.abs(source.x - target.x) * 0.12;
    return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}
function getNodeRadius(node) {
    if (node.marketCapUsd && node.marketCapUsd >= 1_000_000_000_000)
        return 6.2;
    if (node.marketCapUsd && node.marketCapUsd >= 100_000_000_000)
        return 5.1;
    if (node.marketCapUsd && node.marketCapUsd >= 50_000_000_000)
        return 4.3;
    if (node.marketCapUsd && node.marketCapUsd >= 10_000_000_000)
        return 3.5;
    return node.kind === "company" ? 2.9 + node.importanceScore * 1.4 : 1.8 + node.importanceScore * 1.7;
}
function getNodeFill(node, isFocus) {
    if (isFocus)
        return "#ff6b57";
    if (node.kind === "company")
        return "#67e8f9";
    if (node.kind === "material")
        return "#f4b740";
    return "#8ba3b8";
}
function getTierColor(node, depth) {
    if (node.isAnchor)
        return "#ff6b57";
    if (depth === 1)
        return "#67e8f9";
    if (depth === 2)
        return "#73a8ff";
    if (depth === 3)
        return "#f4b740";
    return "#8ba3b8";
}
function getEdgeColor(value) {
    switch (value) {
        case "component_supply":
            return "#67e8f9";
        case "manufacturing":
            return "#f4b740";
        case "raw_material_supply":
            return "#ffd46a";
        case "cloud_service":
            return "#6ee7a8";
        case "logistics":
            return "#77b2ff";
        case "professional_service":
            return "#8ba3b8";
        default:
            return "#67e8f9";
    }
}
