import type { GraphQuery } from "../types/viewModels";

export function getGraphQueryKey(query: GraphQuery) {
  return JSON.stringify({
    companyId: query.companyId?.trim() || null,
    depth: query.depth,
    search: query.search ?? "",
    relationshipSubtype: query.relationshipSubtype?.trim().toLowerCase() || null,
    relationshipTypes: [...(query.relationshipTypes ?? [])].sort(),
  });
}
