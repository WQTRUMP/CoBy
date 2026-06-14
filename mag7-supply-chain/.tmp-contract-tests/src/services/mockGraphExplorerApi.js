import { getCompaniesResponse, getCompanyOverviewResponse, getCompanyResponse, getRelationEvidenceResponse, getSubgraphResponse, } from "../mocks/mockSupplyChain";
export const mockGraphExplorerApi = {
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
