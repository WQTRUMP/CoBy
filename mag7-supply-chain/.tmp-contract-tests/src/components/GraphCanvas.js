import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import { getRelationshipTypeLabel } from "../utils/relationSemantics.js";
export function GraphCanvas(props) {
    const { activeNodeId, activeRelationId, focusNode, graph, onNodeSelect, onRelationSelect, onZoomChange, zoom } = props;
    const viewportId = useId();
    const instructionsId = useId();
    const nodesHeadingId = useId();
    const relationsHeadingId = useId();
    const viewportRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(document.fullscreenElement === viewportRef.current);
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);
    async function handleFullscreenToggle() {
        if (!viewportRef.current) {
            return;
        }
        if (document.fullscreenElement === viewportRef.current) {
            await document.exitFullscreen();
            return;
        }
        await viewportRef.current.requestFullscreen();
    }
    return (_jsxs("section", { className: "graphWorkspace", children: [_jsxs("div", { className: "workspaceHeader", children: [_jsxs("div", { children: [_jsx("h3", { children: "Global Supply Chain Map" }), _jsx("p", { children: "Relationship type and tier depth are encoded directly on the dark graph workspace." }), _jsx("p", { children: "Nodes distinguish group anchors, brand/legal naming, and facility operators instead of flattening all aliases into one surface." })] }), _jsxs("div", { className: "workspaceTopline", children: [_jsxs("div", { className: "inlineLegend", children: [_jsx("span", { children: "Relationship Type" }), graph.relationTypeOptions.map((option) => (_jsxs("strong", { children: [option.label, _jsx("small", { children: option.count })] }, option.value)))] }), _jsxs("div", { className: "inlineLegend", children: [_jsx("span", { children: "Tier Depth" }), _jsx("strong", { children: "1" }), _jsx("strong", { children: "2" }), _jsx("strong", { children: "3" }), _jsx("strong", { children: "4+" })] })] })] }), _jsxs("div", { className: "graphViewport", ref: viewportRef, id: viewportId, children: [_jsx("div", { className: "graphViewportOverlay" }), _jsx("div", { className: "graphDust" }), _jsxs("div", { className: "graphAssistivePanel", "aria-describedby": instructionsId, children: [_jsxs("div", { className: "graphAssistiveHeader", children: [_jsx("strong", { children: "Keyboard exploration" }), _jsx("p", { id: instructionsId, children: "Use the node and relation buttons to inspect the currently visible graph. Selecting a node opens overview details; selecting a relation opens the evidence path." })] }), _jsxs("div", { className: "graphAssistiveSection", "aria-labelledby": nodesHeadingId, children: [_jsxs("div", { className: "graphAssistiveSectionHeader", children: [_jsx("strong", { id: nodesHeadingId, children: "Visible nodes" }), _jsxs("span", { children: [graph.nodes.length, " items"] })] }), _jsx("div", { className: "graphAssistiveList", children: graph.nodes.map((node) => {
                                            const isActive = node.id === activeNodeId;
                                            return (_jsxs("button", { "aria-pressed": isActive, className: isActive ? "graphListButton active" : "graphListButton", onClick: () => onNodeSelect(node), type: "button", children: [_jsx("span", { className: "graphListMeta", children: node.kindLabel }), _jsx("strong", { children: node.displayName }), _jsx("small", { children: node.secondaryLabel ?? node.region })] }, node.id));
                                        }) })] }), _jsxs("div", { className: "graphAssistiveSection", "aria-labelledby": relationsHeadingId, children: [_jsxs("div", { className: "graphAssistiveSectionHeader", children: [_jsx("strong", { id: relationsHeadingId, children: "Visible relations" }), _jsxs("span", { children: [graph.relations.length, " items"] })] }), _jsx("div", { className: "graphAssistiveList", children: graph.relations.map((relation) => {
                                            const source = graph.nodes.find((node) => node.id === relation.sourceId);
                                            const target = graph.nodes.find((node) => node.id === relation.targetId);
                                            const isActive = relation.id === activeRelationId;
                                            const sourceName = source?.displayName ?? relation.sourceId;
                                            const targetName = target?.displayName ?? relation.targetId;
                                            return (_jsxs("button", { "aria-pressed": isActive, className: isActive ? "graphListButton active" : "graphListButton", onClick: () => onRelationSelect(relation), type: "button", children: [_jsxs("span", { className: "graphListMeta", children: [relation.relationshipTypeLabel, " \u00B7 Tier ", relation.tier] }), _jsx("strong", { children: relation.summary }), _jsxs("small", { children: [sourceName, " to ", targetName] })] }, relation.id));
                                        }) })] })] }), _jsx("svg", { viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false", children: _jsxs("g", { transform: `scale(${zoom}) translate(${(1 - zoom) * 50} ${(1 - zoom) * 50})`, children: [graph.relations.map((relation) => {
                                    const source = graph.nodes.find((node) => node.id === relation.sourceId);
                                    const target = graph.nodes.find((node) => node.id === relation.targetId);
                                    if (!source || !target)
                                        return null;
                                    const isActive = relation.id === activeRelationId;
                                    return (_jsxs("g", { children: [_jsx("path", { className: isActive ? "graphEdge active" : "graphEdge", d: curvePath(source, target), onClick: () => onRelationSelect(relation) }), _jsx("text", { className: "graphEdgeLabel", x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 - 2, children: getRelationshipTypeLabel(relation.relationshipType) })] }, relation.id));
                                }), graph.nodes.map((node) => {
                                    const radius = node.kind === "company" ? 5.8 + node.importanceScore * 2.2 : 1.8 + node.importanceScore * 2.8;
                                    return (_jsxs("g", { className: node.id === activeNodeId ? "graphNode active" : "graphNode", transform: `translate(${node.x} ${node.y})`, onClick: () => onNodeSelect(node), children: [_jsx("circle", { r: radius }), _jsx("text", { y: radius + 4.2, children: node.label })] }, node.id));
                                })] }) }), _jsxs("div", { className: "miniMapPlaceholder", children: [_jsx("div", { className: "miniMapHeader", children: "Mini-map" }), _jsx("div", { className: "miniMapFrame" })] }), _jsxs("div", { className: "zoomCluster", children: [_jsx("button", { "aria-label": "Zoom out graph", className: "iconButton", type: "button", onClick: () => onZoomChange(Math.max(0.8, zoom - 0.1)), children: _jsx(Minus, { size: 16 }) }), _jsx("button", { "aria-label": "Zoom in graph", className: "iconButton", type: "button", onClick: () => onZoomChange(Math.min(1.5, zoom + 0.1)), children: _jsx(Plus, { size: 16 }) }), _jsx("button", { "aria-label": isFullscreen ? "Exit fullscreen exploration" : "Enter fullscreen exploration", "aria-pressed": isFullscreen, className: "iconButton", type: "button", onClick: () => {
                                    void handleFullscreenToggle();
                                }, children: _jsx(CornersOut, { size: 16 }) })] }), _jsxs("div", { className: "marketLegend", children: [_jsx("span", { children: "Market importance by market cap (USD)" }), _jsxs("div", { className: "marketLegendDots", children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {}), _jsx("i", {}), _jsx("i", {})] })] }), _jsxs("div", { className: "focusPill", children: [_jsx("strong", { children: focusNode.displayName }), _jsx("span", { children: focusNode.secondaryLabel ?? focusNode.region }), _jsx("small", { children: focusNode.hierarchySummary })] })] })] }));
}
function curvePath(source, target) {
    const controlX = (source.x + target.x) / 2;
    const controlY = Math.min(source.y, target.y) - Math.abs(source.x - target.x) * 0.12;
    return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`;
}
