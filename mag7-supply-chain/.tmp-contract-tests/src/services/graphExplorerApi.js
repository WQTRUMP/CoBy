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
    url;
    contentType;
    constructor(status, statusText, options) {
        super(buildRequestErrorMessage(statusText, options));
        this.name = "ApiRequestError";
        this.status = status;
        this.url = options.url;
        this.contentType = options.contentType;
    }
}
export class ApiPayloadError extends Error {
    status;
    url;
    contentType;
    constructor(message, options) {
        super(message);
        this.name = "ApiPayloadError";
        this.status = options.status;
        this.url = options.url;
        this.contentType = options.contentType;
    }
}
export function createHttpGraphExplorerApi(baseUrl = "") {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    return {
        async listCompanies(query) {
            const normalizedQuery = query?.trim();
            if (normalizedQuery) {
                const url = new URL(`${normalizedBaseUrl}${graphApiContract.companySearch}`, window.location.origin);
                url.searchParams.set("q", normalizedQuery);
                url.searchParams.set("limit", "10");
                return request(url, searchCompaniesResponseSchema);
            }
            const url = new URL(`${normalizedBaseUrl}${graphApiContract.companies}`, window.location.origin);
            return request(url, companyListResponseSchema);
        },
        async getCompany(companyId) {
            return request(`${normalizedBaseUrl}${graphApiContract.company.replace(":companyId", encodeURIComponent(companyId))}`, companyDetailResponseSchema);
        },
        async getCompanyOverview(companyId) {
            return request(`${normalizedBaseUrl}${graphApiContract.overview.replace(":companyId", encodeURIComponent(companyId))}`, companyOverviewSchema);
        },
        async getSubgraph(query) {
            const parsed = subgraphQuerySchema.parse({
                ...query,
                includeEvidence: query.includeEvidence ?? true,
            });
            const url = new URL(`${normalizedBaseUrl}${graphApiContract.subgraph}`, window.location.origin);
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
            return request(`${normalizedBaseUrl}${graphApiContract.evidence.replace(":relationId", encodeURIComponent(relationId))}`, relationEvidenceResponseSchema);
        },
    };
}
async function request(input, schema) {
    const url = String(input);
    const response = await fetch(input, {
        headers: {
            Accept: "application/json",
        },
    });
    const rawText = await response.text();
    const diagnostics = {
        contentType: getResponseHeader(response, "content-type"),
        status: response.status,
        url,
    };
    if (!response.ok) {
        throw new ApiRequestError(response.status, response.statusText, {
            status: response.status,
            ...diagnostics,
            rawText,
        });
    }
    const payload = parseJsonPayload(rawText, diagnostics);
    return schema.parse(payload);
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.trim().replace(/\/+$/, "");
}
function getResponseHeader(response, name) {
    if (!response.headers || typeof response.headers.get !== "function") {
        return null;
    }
    return response.headers.get(name);
}
function parseJsonPayload(rawText, diagnostics) {
    try {
        return JSON.parse(rawText);
    }
    catch (error) {
        throw new ApiPayloadError(buildPayloadErrorMessage(rawText, diagnostics), diagnostics);
    }
}
function buildPayloadErrorMessage(rawText, diagnostics) {
    const maybeHtml = isProbablyHtmlDocument(rawText, diagnostics.contentType);
    const responseType = maybeHtml ? "HTML document" : "non-JSON payload";
    const hint = maybeHtml
        ? "This usually means the frontend served index.html for /api. Set VITE_GRAPH_API_BASE_URL to the backend origin or use the built-in /api proxy in Vite dev/preview."
        : `Response preview: ${truncateSnippet(rawText)}`;
    return `Expected JSON from ${diagnostics.url} but received ${responseType} (status ${diagnostics.status}, content-type ${diagnostics.contentType ?? "unknown"}). ${hint}`;
}
function buildRequestErrorMessage(statusText, diagnostics) {
    const maybeHtml = isProbablyHtmlDocument(diagnostics.rawText, diagnostics.contentType);
    if (maybeHtml) {
        return `API request failed: ${diagnostics.status} ${statusText} for ${diagnostics.url}. The response was HTML instead of JSON, which usually means the frontend served index.html for /api. Set VITE_GRAPH_API_BASE_URL to the backend origin or use the built-in /api proxy in Vite dev/preview.`;
    }
    if (isLikelyLocalProxyFailure(diagnostics.url, diagnostics.status)) {
        return `API request failed: ${diagnostics.status} ${statusText} for ${diagnostics.url}. The request hit the local /api proxy, but the upstream backend was unreachable or returned a server error. Start the backend on the proxy target or set VITE_GRAPH_API_BASE_URL to a reachable API origin. Diagnose with curl ${diagnostics.url} and curl http://127.0.0.1:4000/api/v1/health. Response preview: ${truncateSnippet(diagnostics.rawText)}`;
    }
    return `API request failed: ${diagnostics.status} ${statusText} for ${diagnostics.url}. Response preview: ${truncateSnippet(diagnostics.rawText)}`;
}
function isProbablyHtmlDocument(rawText, contentType) {
    const normalized = rawText.trimStart().toLowerCase();
    return (contentType ?? "").includes("text/html") || normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}
function isLikelyLocalProxyFailure(url, status) {
    if (status < 500) {
        return false;
    }
    if (typeof window === "undefined" || !window.location?.origin) {
        return false;
    }
    return url.startsWith(`${window.location.origin}/api/`);
}
function truncateSnippet(rawText) {
    const snippet = rawText.replace(/\s+/g, " ").trim();
    if (!snippet) {
        return "<empty>";
    }
    return snippet.length > 140 ? `${snippet.slice(0, 137)}...` : snippet;
}
