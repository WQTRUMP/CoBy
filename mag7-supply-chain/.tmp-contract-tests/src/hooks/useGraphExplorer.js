import { useEffect, useState } from "react";
import { adaptCompanyOptions, adaptGraphViewModel, adaptRelationEvidence } from "../adapters/graphExplorerAdapter";
import { ApiRequestError } from "../services/graphExplorerApi";
import { resolveFallbackCompanyId } from "./graphExplorerSelection";
export function useGraphExplorer(api, query) {
    const [state, setState] = useState({
        companies: [],
        graph: null,
        error: null,
        loading: true,
    });
    const [relationEvidenceById, setRelationEvidenceById] = useState({});
    useEffect(() => {
        let alive = true;
        async function load() {
            setState((current) => ({ ...current, error: null, loading: true }));
            try {
                const companiesResponse = await api.listCompanies(query.search);
                const companies = adaptCompanyOptions(companiesResponse);
                const requestedCompanyId = query.companyId?.trim() || null;
                const fallbackCompanyId = resolveFallbackCompanyId(companies, requestedCompanyId);
                const initialCompanyId = requestedCompanyId ?? fallbackCompanyId;
                if (!initialCompanyId) {
                    if (!alive)
                        return;
                    setRelationEvidenceById({});
                    setState({
                        companies,
                        graph: null,
                        error: "No companies are available for this view.",
                        loading: false,
                    });
                    return;
                }
                const loadGraph = async (companyId) => {
                    const [company, overview, subgraph] = await Promise.all([
                        api.getCompany(companyId),
                        api.getCompanyOverview(companyId),
                        api.getSubgraph({
                            companyId,
                            depth: query.depth,
                            snapshot: "published",
                            includeEvidence: true,
                        }),
                    ]);
                    return adaptGraphViewModel({
                        company,
                        overview,
                        subgraph,
                        query: {
                            ...query,
                            companyId,
                        },
                    });
                };
                let graph;
                try {
                    graph = await loadGraph(initialCompanyId);
                }
                catch (error) {
                    const canFallback = requestedCompanyId !== null &&
                        fallbackCompanyId !== null &&
                        fallbackCompanyId !== requestedCompanyId &&
                        error instanceof ApiRequestError &&
                        error.status === 404;
                    if (!canFallback) {
                        throw error;
                    }
                    graph = await loadGraph(fallbackCompanyId);
                }
                if (!alive)
                    return;
                setRelationEvidenceById(Object.fromEntries(graph.relations
                    .filter((relation) => relation.evidence.length > 0)
                    .map((relation) => [relation.id, relation.evidence])));
                setState({
                    companies,
                    graph,
                    error: null,
                    loading: false,
                });
            }
            catch (error) {
                if (!alive)
                    return;
                setState((current) => ({
                    ...current,
                    error: error instanceof Error ? error.message : "Failed to load graph explorer.",
                    loading: false,
                }));
            }
        }
        void load();
        return () => {
            alive = false;
        };
    }, [api, query.companyId, query.depth, query.search]);
    async function loadRelationEvidence(relation) {
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
