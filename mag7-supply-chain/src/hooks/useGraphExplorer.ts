import { useEffect, useState } from "react";
import type { CompanyDetail, GraphQuery, SubgraphDTO } from "../types/contracts";
import type { GraphExplorerApi } from "../services/graphExplorerApi";

interface ExplorerState {
  companies: CompanyDetail[];
  graph: SubgraphDTO | null;
  loading: boolean;
}

export function useGraphExplorer(api: GraphExplorerApi, query: GraphQuery) {
  const [state, setState] = useState<ExplorerState>({
    companies: [],
    graph: null,
    loading: true,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const [companies, graph] = await Promise.all([api.listCompanies(), api.getSubgraph(query)]);
      if (!alive) return;
      setState({ companies, graph, loading: false });
    }

    void load();

    return () => {
      alive = false;
    };
  }, [api, query.companyId, query.depth, query.search]);

  return state;
}
