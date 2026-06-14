import {
  companyDetailResponseSchema,
  companyListResponseSchema,
  companyOverviewSchema,
  relationEvidenceResponseSchema,
  subgraphQuerySchema,
  subgraphSchema,
} from "../../packages/contracts/src/index.js";
import type {
  CompanyDetailResponseDTO,
  CompanyListResponseDTO,
  CompanyOverviewDTO,
  RelationEvidenceResponseDTO,
  SubgraphDTO,
  SubgraphQuery,
} from "../../packages/contracts/src/index.js";

export interface GraphExplorerApi {
  listCompanies(query?: string): Promise<CompanyListResponseDTO>;
  getCompany(companyId: string): Promise<CompanyDetailResponseDTO>;
  getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO>;
  getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO>;
  getRelationEvidence(relationId: string): Promise<RelationEvidenceResponseDTO>;
}

export const graphApiContract = {
  companies: "/api/v1/companies",
  company: "/api/v1/companies/:companyId",
  overview: "/api/v1/companies/:companyId/overview",
  subgraph: "/api/v1/graph/subgraph",
  evidence: "/api/v1/relations/:relationId/evidence",
} as const;

export function createHttpGraphExplorerApi(baseUrl = ""): GraphExplorerApi {
  return {
    async listCompanies(query) {
      const url = new URL(`${baseUrl}${graphApiContract.companies}`, window.location.origin);
      if (query?.trim()) {
        url.searchParams.set("q", query.trim());
      }

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
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  return schema.parse(payload);
}
