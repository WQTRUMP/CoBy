import { useEffect, useState } from "react";
import { adaptCompanyOptions, adaptGraphViewModel, adaptRelationEvidence } from "../adapters/graphExplorerAdapter";
import type { GraphExplorerApi } from "../services/graphExplorerApi";
import type {
  CompanyOptionViewModel,
  EvidenceViewModel,
  GraphQuery,
  GraphRelationViewModel,
  GraphViewModel,
} from "../types/viewModels";

interface ExplorerState {
  companies: CompanyOptionViewModel[];
  graph: GraphViewModel | null;
  loading: boolean;
}

export function useGraphExplorer(api: GraphExplorerApi, query: GraphQuery) {
  const [state, setState] = useState<ExplorerState>({
    companies: [],
    graph: null,
    loading: true,
  });
  const [relationEvidenceById, setRelationEvidenceById] = useState<Record<string, EvidenceViewModel[]>>({});

  useEffect(() => {
    let alive = true;

    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const [companies, company, overview, subgraph] = await Promise.all([
        api.listCompanies(query.search),
        api.getCompany(query.companyId),
        api.getCompanyOverview(query.companyId),
        api.getSubgraph({
          companyId: query.companyId,
          depth: query.depth,
          snapshot: "published",
          includeEvidence: true,
        }),
      ]);

      if (!alive) return;

      const graph = adaptGraphViewModel({
        company,
        overview,
        subgraph,
        query,
      });

      setRelationEvidenceById(
        Object.fromEntries(
          graph.relations
            .filter((relation) => relation.evidence.length > 0)
            .map((relation) => [relation.id, relation.evidence]),
        ),
      );

      setState({
        companies: adaptCompanyOptions(companies),
        graph,
        loading: false,
      });
    }

    void load();

    return () => {
      alive = false;
    };
  }, [api, query.companyId, query.depth, query.search]);

  async function loadRelationEvidence(relation: GraphRelationViewModel | null) {
    if (!relation) {
      return [];
    }

    const existing = relationEvidenceById[relation.id];
    if (existing) {
      return existing;
    }

    const response = await api.getRelationEvidence(relation.id);
    const evidence = adaptRelationEvidence(response, relation);
    setRelationEvidenceById((current) => ({ ...current, [relation.id]: evidence }));
    return evidence;
  }

  return {
    ...state,
    relationEvidenceById,
    loadRelationEvidence,
  };
}
