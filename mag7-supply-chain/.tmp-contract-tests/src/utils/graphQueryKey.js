export function getGraphQueryKey(query) {
    return JSON.stringify({
        companyId: query.companyId?.trim() || null,
        depth: query.depth,
        search: query.search ?? "",
        relationshipSubtype: query.relationshipSubtype?.trim().toLowerCase() || null,
        relationshipTypes: [...(query.relationshipTypes ?? [])].sort(),
    });
}
