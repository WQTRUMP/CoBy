import { useEffect, useMemo, useState } from "react";
import { adaptCompanyOptions, adaptGraphViewModel, adaptRelationEvidence } from "../adapters/graphExplorerAdapter";
import { ApiRequestError } from "../services/graphExplorerApi";
import { getGraphQueryKey } from "../utils/graphQueryKey.js";
import { resolveFallbackCompanyId } from "./graphExplorerSelection";
export function useGraphExplorer(api, query) {
    const [state, setState] = useState({
        companies: [],
        error: null,
        loading: true,
    });
    const [rawGraph, setRawGraph] = useState(null);
    const [relationEvidenceById, setRelationEvidenceById] = useState({});
    const queryKey = getGraphQueryKey(query);
    const requestCompanyId = query.companyId?.trim() || null;
    const searchQuery = query.search?.trim() ?? "";
    useEffect(() => {
        let alive = true;
        async function load() {
            setState((current) => ({ ...current, error: null, loading: true }));
            try {
                const companiesResponse = await api.listCompanies(query.search);
                const companies = adaptCompanyOptions(companiesResponse);
                const fallbackCompanyId = resolveFallbackCompanyId(companies, requestCompanyId);
                const initialCompanyId = requestCompanyId ?? fallbackCompanyId;
                if (!initialCompanyId) {
                    if (!alive)
                        return;
                    setRawGraph(null);
                    setRelationEvidenceById({});
                    setState({
                        companies,
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
                    return { company, overview, subgraph };
                };
                let nextRawGraph;
                try {
                    nextRawGraph = await loadGraph(initialCompanyId);
                }
                catch (error) {
                    const canFallback = requestCompanyId !== null &&
                        fallbackCompanyId !== null &&
                        fallbackCompanyId !== requestCompanyId &&
                        error instanceof ApiRequestError &&
                        error.status === 404;
                    if (!canFallback) {
                        throw error;
                    }
                    nextRawGraph = await loadGraph(fallbackCompanyId);
                }
                if (!alive)
                    return;
                setRawGraph(nextRawGraph);
                setState({
                    companies,
                    error: null,
                    loading: false,
                });
            }
            catch (error) {
                if (!alive)
                    return;
                setRawGraph(null);
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
    }, [api, query.depth, requestCompanyId, searchQuery]);
    const graph = useMemo(() => {
        if (!rawGraph) {
            return null;
        }
        return adaptGraphViewModel({
            company: rawGraph.company,
            overview: rawGraph.overview,
            subgraph: rawGraph.subgraph,
            query,
        });
    }, [queryKey, query, rawGraph]);
    useEffect(() => {
        if (!graph) {
            setRelationEvidenceById({});
            return;
        }
        setRelationEvidenceById((current) => ({
            ...Object.fromEntries(graph.relations.filter((relation) => relation.evidence.length > 0).map((relation) => [relation.id, relation.evidence])),
            ...current,
        }));
    }, [graph]);
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
        graph,
        relationEvidenceById,
        loadRelationEvidence,
    };
}
