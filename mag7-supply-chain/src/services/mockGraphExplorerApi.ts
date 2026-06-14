import { getCompanies, getSubgraph } from "../mocks/mockSupplyChain";
import type { GraphExplorerApi } from "./graphExplorerApi";

export const mockGraphExplorerApi: GraphExplorerApi = {
  async listCompanies() {
    return getCompanies();
  },
  async getSubgraph(query) {
    return getSubgraph(query.companyId, query.depth, query.search);
  },
};
