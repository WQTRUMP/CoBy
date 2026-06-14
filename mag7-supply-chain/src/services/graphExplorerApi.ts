import {
  companyDetailResponseSchema,
  companyListResponseSchema,
  companyOverviewSchema,
  relationEvidenceResponseSchema,
  searchCompaniesResponseSchema,
  subgraphQuerySchema,
  subgraphSchema,
} from "@mag7/contracts";
import type {
  CompanyDetailResponseDTO,
  CompanyListResponseDTO,
  CompanyOverviewDTO,
  RelationEvidenceResponseDTO,
  SearchCompaniesResponseDTO,
  SubgraphDTO,
  SubgraphQuery,
} from "@mag7/contracts";

export interface GraphExplorerApi {
  listCompanies(query?: string): Promise<CompanyListResponseDTO | SearchCompaniesResponseDTO>;
  getCompany(companyId: string): Promise<CompanyDetailResponseDTO>;
  getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO>;
  getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO>;
  getRelationEvidence(relationId: string): Promise<RelationEvidenceResponseDTO>;
}

export const graphApiContract = {
  companies: "/api/v1/companies",
  companySearch: "/api/v1/companies/search",
  company: "/api/v1/companies/:companyId",
  overview: "/api/v1/companies/:companyId/overview",
  subgraph: "/api/v1/graph/subgraph",
  evidence: "/api/v1/relations/:relationId/evidence",
} as const;

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, statusText: string) {
    super(`API request failed: ${status} ${statusText}`);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export class ApiPayloadError extends Error {
  status: number;
  url: string;
  contentType: string | null;

  constructor(message: string, options: { status: number; url: string; contentType: string | null }) {
    super(message);
    this.name = "ApiPayloadError";
    this.status = options.status;
    this.url = options.url;
    this.contentType = options.contentType;
  }
}

export function createHttpGraphExplorerApi(baseUrl = ""): GraphExplorerApi {
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
      return request(
        `${normalizedBaseUrl}${graphApiContract.company.replace(":companyId", encodeURIComponent(companyId))}`,
        companyDetailResponseSchema,
      );
    },
    async getCompanyOverview(companyId) {
      return request(
        `${normalizedBaseUrl}${graphApiContract.overview.replace(":companyId", encodeURIComponent(companyId))}`,
        companyOverviewSchema,
      );
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
      return request(
        `${normalizedBaseUrl}${graphApiContract.evidence.replace(":relationId", encodeURIComponent(relationId))}`,
        relationEvidenceResponseSchema,
      );
    },
  };
}

async function request<T>(
  input: string | URL,
  schema: { parse: (value: unknown) => T },
): Promise<T> {
  const response = await fetch(input, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, response.statusText);
  }

  const rawText = await response.text();
  const payload = parseJsonPayload(rawText, {
    contentType: getResponseHeader(response, "content-type"),
    status: response.status,
    url: String(input),
  });
  return schema.parse(payload);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function getResponseHeader(response: ResponseLike, name: string): string | null {
  if (!response.headers || typeof response.headers.get !== "function") {
    return null;
  }

  return response.headers.get(name);
}

function parseJsonPayload(
  rawText: string,
  diagnostics: {
    contentType: string | null;
    status: number;
    url: string;
  },
): unknown {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new ApiPayloadError(buildPayloadErrorMessage(rawText, diagnostics), diagnostics);
  }
}

function buildPayloadErrorMessage(
  rawText: string,
  diagnostics: {
    contentType: string | null;
    status: number;
    url: string;
  },
): string {
  const maybeHtml = isProbablyHtmlDocument(rawText, diagnostics.contentType);
  const responseType = maybeHtml ? "HTML document" : "non-JSON payload";
  const hint = maybeHtml
    ? "This usually means the frontend served index.html for /api. Set VITE_GRAPH_API_BASE_URL to the backend origin or use the built-in /api proxy in Vite dev/preview."
    : `Response preview: ${truncateSnippet(rawText)}`;

  return `Expected JSON from ${diagnostics.url} but received ${responseType} (status ${diagnostics.status}, content-type ${diagnostics.contentType ?? "unknown"}). ${hint}`;
}

function isProbablyHtmlDocument(rawText: string, contentType: string | null): boolean {
  const normalized = rawText.trimStart().toLowerCase();
  return (contentType ?? "").includes("text/html") || normalized.startsWith("<!doctype html") || normalized.startsWith("<html");
}

function truncateSnippet(rawText: string): string {
  const snippet = rawText.replace(/\s+/g, " ").trim();
  if (!snippet) {
    return "<empty>";
  }

  return snippet.length > 140 ? `${snippet.slice(0, 137)}...` : snippet;
}

interface ResponseLike {
  headers?: {
    get(name: string): string | null;
  } | null;
}
