import { formatDateResolution, formatRelationshipSubtype, formatSourceMethod, formatValidityLabel, getRelationshipSemanticLabel, getRelationshipTypeLabel, } from "../utils/relationSemantics";
const SOURCE_TYPE_LABELS = {
    "10k": "10-K",
    earnings_call: "Earnings Call",
    supplier_report: "Supplier Report",
    media: "Media",
    industry_report: "Industry Report",
    press_release: "Press Release",
    official_doc: "Official Document",
};
const ENTITY_KIND_BY_TYPE = {
    Company: "company",
    Facility: "facility",
    Product: "product",
    Technology: "technology",
    Material: "material",
};
export function adaptCompanyOptions(response) {
    return response.items.map(adaptCompanyOption);
}
export function adaptCompanyOverview(overview) {
    return {
        companyId: overview.companyId,
        companyName: overview.companyName,
        activeSnapshotId: overview.activeSnapshotId,
        supplierCount: overview.supplierCount,
        tier1SupplierCount: overview.tier1SupplierCount,
        relationCount: overview.totalRelations,
        evidenceCount: overview.evidenceCount,
        criticalDependencyCount: overview.highRiskRelationCount,
        evidenceCoverage: overview.evidenceCoverage,
        lastUpdated: overview.lastUpdatedAt,
        source: overview.source,
    };
}
export function adaptCompanyProfile(response, overview) {
    const company = response.item;
    const option = adaptCompanyOption(company);
    const overviewView = adaptCompanyOverview(overview);
    return {
        ...option,
        summary: company.summary ?? company.description ?? `${company.name} supply-chain overview.`,
        overview: overviewView,
        apiBindings: {
            companyEndpoint: `/api/v1/companies/${company.id}`,
            overviewEndpoint: `/api/v1/companies/${company.id}/overview`,
            graphEndpoint: `/api/v1/graph/subgraph?companyId=${encodeURIComponent(company.id)}`,
            evidenceEndpoint: "/api/v1/relations/:relationId/evidence",
        },
        lastUpdated: company.lastUpdatedAt ?? overview.lastUpdatedAt,
        source: response.source,
    };
}
export function adaptGraphViewModel(input) {
    const focusCompany = adaptCompanyProfile(input.company, input.overview);
    const layout = buildNodeLayout(input.subgraph.nodes, input.subgraph.relations, focusCompany.id);
    const typeFilteredRelations = input.subgraph.relations.filter((relation) => matchesRelationshipTypeFilter(relation, input.query));
    const filteredRelations = typeFilteredRelations.filter((relation) => matchesRelationshipSubtypeFilter(relation, input.query));
    const visibleNodeIds = selectVisibleNodeIds(layout, filteredRelations, focusCompany.id, input.query.search);
    const nodes = layout.filter((node) => visibleNodeIds.has(node.id));
    const relations = filteredRelations
        .filter((relation) => visibleNodeIds.has(relation.sourceId) && visibleNodeIds.has(relation.targetId))
        .map((relation) => adaptRelation(relation, focusCompany.id));
    return {
        snapshot: input.subgraph.snapshot,
        focusCompany,
        nodes,
        relations,
        evidenceOverview: summarizeEvidence(relations),
        relationTypeOptions: collectRelationTypeOptions(typeFilteredRelations.length > 0 ? typeFilteredRelations : input.subgraph.relations),
        relationshipSubtypeOptions: collectRelationshipSubtypeOptions(typeFilteredRelations),
    };
}
export function adaptRelationEvidence(response, relation) {
    return response.items.map((item) => adaptEvidence(item, relation.confidence));
}
function adaptCompanyOption(company) {
    return {
        id: company.id,
        ticker: company.ticker ?? company.name.slice(0, 4).toUpperCase(),
        name: company.name,
        shortName: getShortName(company),
        focus: company.name,
        primaryRegion: company.primaryRegion,
        marketCapUsd: company.marketCapUsd,
        isMag7: company.isMag7,
    };
}
function adaptRelation(relation, companyId) {
    return {
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationshipType: relation.relationshipType,
        relationshipTypeLabel: getRelationshipTypeLabel(relation.relationshipType),
        relationshipSemanticLabel: getRelationshipSemanticLabel(relation.relationshipType),
        relationshipSubtype: relation.relationshipSubtype ?? null,
        relationshipSubtypeLabel: formatRelationshipSubtype(relation.relationshipSubtype),
        tier: relation.tier,
        depthFromMag7: relation.depthFromMag7,
        confidence: relation.confidence,
        confidenceScore: relation.confidenceScore,
        summary: relation.summary,
        productScope: relation.productScope,
        notes: relation.notes ?? null,
        sourceMethod: relation.sourceMethod ?? null,
        sourceMethodLabel: formatSourceMethod(relation.sourceMethod),
        evidenceDateResolution: relation.evidenceDateResolution ?? null,
        evidenceDateResolutionLabel: formatDateResolution(relation.evidenceDateResolution),
        validFrom: relation.validFrom ?? null,
        validTo: relation.validTo ?? null,
        validityLabel: formatValidityLabel(relation.validFrom, relation.validTo),
        evidenceCount: relation.evidenceCount,
        evidence: (relation.evidence ?? []).map((item) => adaptEvidence(item, relation.confidence)),
        isDirectRelation: relation.sourceId === companyId || relation.targetId === companyId,
    };
}
function adaptEvidence(evidence, confidence) {
    return {
        id: evidence.id,
        title: evidence.title,
        publisher: evidence.publisher,
        sourceType: evidence.sourceType,
        sourceTypeLabel: SOURCE_TYPE_LABELS[evidence.sourceType],
        publishedAt: evidence.publishedAt,
        url: evidence.url,
        citation: evidence.citationText,
        excerpt: evidence.excerpt,
        pageRef: evidence.pageRef ?? null,
        confidence,
    };
}
function summarizeEvidence(relations) {
    return relations.reduce((summary, relation) => {
        if (relation.confidence === "strong_evidence") {
            summary.strongEvidence += relation.evidenceCount;
        }
        else {
            summary[relation.confidence] += relation.evidenceCount;
        }
        return summary;
    }, { confirmed: 0, strongEvidence: 0, inferred: 0 });
}
function buildNodeLayout(nodes, relations, companyId) {
    const depths = calculateNodeDepths(nodes, relations, companyId);
    const nodesByDepth = new Map();
    for (const node of nodes) {
        const depth = depths.get(node.id) ?? 0;
        const bucket = nodesByDepth.get(depth) ?? [];
        bucket.push(node);
        nodesByDepth.set(depth, bucket);
    }
    const maxDepth = Math.max(...nodesByDepth.keys(), 0);
    const left = 14;
    const right = 84;
    return [...nodes]
        .sort((leftNode, rightNode) => (depths.get(leftNode.id) ?? 0) - (depths.get(rightNode.id) ?? 0))
        .map((node) => {
        const depth = depths.get(node.id) ?? 0;
        const bucket = (nodesByDepth.get(depth) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label));
        const index = bucket.findIndex((item) => item.id === node.id);
        const rowStep = 62 / Math.max(bucket.length - 1, 1);
        const x = maxDepth === 0 ? 50 : left + ((right - left) / maxDepth) * depth;
        const y = bucket.length === 1 ? 50 : 19 + rowStep * index;
        return {
            id: node.id,
            label: node.label,
            secondaryLabel: node.company?.ticker ?? node.country ?? node.entityType,
            kind: ENTITY_KIND_BY_TYPE[node.entityType],
            region: node.company?.country ?? node.country ?? "Global",
            importanceScore: node.importanceScore ?? node.company?.importanceScore ?? 0.45,
            marketCapUsd: node.marketCapUsd ?? node.company?.marketCapUsd ?? null,
            x,
            y,
            isAnchor: node.id === companyId,
        };
    });
}
function calculateNodeDepths(nodes, relations, companyId) {
    const adjacency = new Map();
    for (const node of nodes) {
        adjacency.set(node.id, []);
    }
    for (const relation of relations) {
        adjacency.set(relation.sourceId, [...(adjacency.get(relation.sourceId) ?? []), relation.targetId]);
        adjacency.set(relation.targetId, [...(adjacency.get(relation.targetId) ?? []), relation.sourceId]);
    }
    const depths = new Map([[companyId, 0]]);
    const queue = [companyId];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current)
            continue;
        const baseDepth = depths.get(current) ?? 0;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (depths.has(neighbor))
                continue;
            depths.set(neighbor, baseDepth + 1);
            queue.push(neighbor);
        }
    }
    for (const node of nodes) {
        if (!depths.has(node.id)) {
            depths.set(node.id, 0);
        }
    }
    return depths;
}
function selectVisibleNodeIds(nodes, relations, companyId, search) {
    const trimmed = search?.trim().toLowerCase();
    const allNodeIds = new Set(nodes.map((node) => node.id));
    if (!trimmed) {
        return allNodeIds;
    }
    const matchedIds = new Set(nodes
        .filter((node) => `${node.label} ${node.secondaryLabel} ${node.region}`.toLowerCase().includes(trimmed))
        .map((node) => node.id));
    if (matchedIds.size === 0) {
        matchedIds.add(companyId);
    }
    for (const relation of relations) {
        if (matchedIds.has(relation.sourceId) || matchedIds.has(relation.targetId)) {
            matchedIds.add(relation.sourceId);
            matchedIds.add(relation.targetId);
        }
    }
    matchedIds.add(companyId);
    return matchedIds;
}
function matchesRelationshipTypeFilter(relation, query) {
    if (!query.relationshipTypes || query.relationshipTypes.length === 0) {
        return true;
    }
    return query.relationshipTypes.includes(relation.relationshipType);
}
function matchesRelationshipSubtypeFilter(relation, query) {
    const subtype = query.relationshipSubtype?.trim().toLowerCase();
    if (!subtype) {
        return true;
    }
    return relation.relationshipSubtype?.trim().toLowerCase() === subtype;
}
function collectRelationTypeOptions(relations) {
    const counts = new Map();
    for (const relation of relations) {
        counts.set(relation.relationshipType, (counts.get(relation.relationshipType) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([value, count]) => ({
        value,
        count,
        label: getRelationshipTypeLabel(value),
    }));
}
function collectRelationshipSubtypeOptions(relations) {
    const counts = new Map();
    for (const relation of relations) {
        if (!relation.relationshipSubtype) {
            continue;
        }
        counts.set(relation.relationshipSubtype, (counts.get(relation.relationshipSubtype) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([value, count]) => ({
        value,
        count,
        label: formatRelationshipSubtype(value) ?? value,
    }));
}
function getShortName(company) {
    return company.aliases?.[0]?.replace(/,?\s+(Inc|Inc\.|Corporation|Corp\.|Ltd\.|Limited|Holdings|Platforms)$/i, "") ??
        company.name.replace(/,?\s+(Inc|Inc\.|Corporation|Corp\.|Ltd\.|Limited|Holdings|Platforms)$/i, "");
}
