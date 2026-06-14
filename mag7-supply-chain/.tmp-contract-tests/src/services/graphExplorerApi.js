import { companyDetailResponseSchema, companyListResponseSchema, companyOverviewSchema, relationEvidenceResponseSchema, searchCompaniesResponseSchema, subgraphQuerySchema, subgraphSchema, } from "@mag7/contracts";
export const graphApiContract = {
    companies: "/api/v1/companies",
    companySearch: "/api/v1/companies/search",
    company: "/api/v1/companies/:companyId",
    overview: "/api/v1/companies/:companyId/overview",
    subgraph: "/api/v1/graph/subgraph",
    evidence: "/api/v1/relations/:relationId/evidence",
};
export class ApiRequestError extends Error {
    status;
    constructor(status, statusText) {
        super(`API request failed: ${status} ${statusText}`);
        this.name = "ApiRequestError";
        this.status = status;
    }
}
export function createHttpGraphExplorerApi(baseUrl = "") {
    return {
        async listCompanies(query) {
            const normalizedQuery = query?.trim();
            const isSearch = Boolean(normalizedQuery);
            const url = new URL(`${baseUrl}${isSearch ? graphApiContract.companySearch : graphApiContract.companies}`, window.location.origin);
            if (normalizedQuery) {
                url.searchParams.set("q", normalizedQuery);
                url.searchParams.set("limit", "10");
            }
            return request(url, isSearch ? searchCompaniesResponseSchema : companyListResponseSchema);
        },
        async getCompany(companyId) {
            return request(`${baseUrl}${graphApiContract.company.replace(":companyId", encodeURIComponent(companyId))}`, companyDetailResponseSchema);
        },
        async getCompanyOverview(companyId) {
            return request(`${baseUrl}${graphApiContract.overview.replace(":companyId", encodeURIComponent(companyId))}`, companyOverviewSchema);
        },
        async getSubgraph(query) {
            const parsed = subgraphQuerySchema.parse({
                ...query,
                includeEvidence: query.includeEvidence ?? true,
            });
            const url = new URL(`${baseUrl}${graphApiContract.subgraph}`, window.location.origin);
            url.searchParams.set("companyId", parsed.companyId);
            url.searchParams.set("depth", String(parsed.depth));
            url.searchParams.set("snapshot", parsed.snapshot);
            url.searchParams.set("includeEvidence", String(parsed.includeEvidence));
            for (const relationshipType of parsed.relationshipTypes ?? []) {
                url.searchParams.append("relationshipTypes", relationshipType);
            }
            return request(url, subgraphSchema);
        },
        async getRelationEvidence(relationId) {
            return request(`${baseUrl}${graphApiContract.evidence.replace(":relationId", encodeURIComponent(relationId))}`, relationEvidenceResponseSchema);
        },
    };
}
async function request(input, schema) {
    const response = await fetch(input, {
        headers: {
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new ApiRequestError(response.status, response.statusText);
    }
    const payload = await response.json();
    return schema.parse(payload);
}
