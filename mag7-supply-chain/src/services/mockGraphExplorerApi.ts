import {
  getCompaniesResponse,
  getCompanyOverviewResponse,
  getCompanyResponse,
  getRelationEvidenceResponse,
  getSubgraphResponse,
} from "../mocks/mockSupplyChain";
import type { GraphExplorerApi } from "./graphExplorerApi";

export const mockGraphExplorerApi: GraphExplorerApi = {
  async listCompanies(query) {
    return getCompaniesResponse(query);
  },
  async getCompany(companyId) {
    return getCompanyResponse(companyId);
  },
  async getCompanyOverview(companyId) {
    return getCompanyOverviewResponse(companyId);
  },
  async getSubgraph(query) {
    return getSubgraphResponse(query.companyId, query.depth, query.includeEvidence ?? true);
  },
  async getRelationEvidence(relationId) {
    return getRelationEvidenceResponse(relationId);
  },
};
