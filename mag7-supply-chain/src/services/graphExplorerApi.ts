import type { CompanyDetail, GraphQuery, SubgraphDTO } from "../types/contracts";

export interface GraphExplorerApi {
  listCompanies(): Promise<CompanyDetail[]>;
  getSubgraph(query: GraphQuery): Promise<SubgraphDTO>;
}

export const graphApiContract = {
  companies: "/api/v1/companies",
  subgraph: "/api/v1/graph/subgraph",
  evidence: "/api/v1/relations/:relationId/evidence",
} as const;
