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

export function createHttpGraphExplorerApi(baseUrl = ""): GraphExplorerApi {
  return {
    async listCompanies(query) {
      const normalizedQuery = query?.trim();
      if (normalizedQuery) {
        const url = new URL(`${baseUrl}${graphApiContract.companySearch}`, window.location.origin);
        url.searchParams.set("q", normalizedQuery);
        url.searchParams.set("limit", "10");
        return request(url, searchCompaniesResponseSchema);
      }

      const url = new URL(`${baseUrl}${graphApiContract.companies}`, window.location.origin);
      return request(url, companyListResponseSchema);
    },
    async getCompany(companyId) {
      return request(
        `${baseUrl}${graphApiContract.company.replace(":companyId", encodeURIComponent(companyId))}`,
        companyDetailResponseSchema,
      );
    },
    async getCompanyOverview(companyId) {
      return request(
        `${baseUrl}${graphApiContract.overview.replace(":companyId", encodeURIComponent(companyId))}`,
        companyOverviewSchema,
      );
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
      return request(
        `${baseUrl}${graphApiContract.evidence.replace(":relationId", encodeURIComponent(relationId))}`,
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

  const payload: unknown = await response.json();
  return schema.parse(payload);
}
