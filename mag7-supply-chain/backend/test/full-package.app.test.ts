import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
  type PreparedNormalizedImport,
} from "../src/lib/normalized-package.js";
import type { CacheClient } from "../src/lib/redis.js";
import type { GraphRepository, Neo4jHealth } from "../src/lib/neo4j.js";
import type {
  CompanyDetailDTO,
  CompanyListQuery,
  CompanySearchMatchDTO,
  CompanyOverviewDTO,
  EvidenceDTO,
  GraphNodeDTO,
  GraphPathQuery,
  GraphStatsDTO,
  GraphStatsQuery,
  RelationDTO,
  SnapshotDTO,
  SubgraphDTO,
  SubgraphQuery,
  SearchCompaniesQuery,
  SuggestCompaniesQuery,
} from "@mag7/contracts";

const FULL_PACKAGE_DIR = "/workspace/agents/evidence-collector/output/mag7-full-package";
const MAG7_COMPANY_IDS = [
  "company:AAPL",
  "company:MSFT",
  "company:GOOGL",
  "company:META",
  "company:AMZN",
  "company:NVDA",
  "company:TSLA",
];

const cache = new Map<string, string>();

const cacheClient: CacheClient = {
  enabled: true,
  async get(key) {
    return cache.get(key) ?? null;
  },
  async set(key, value) {
    cache.set(key, value);
  },
  async del(key) {
    cache.delete(key);
  },
  async health() {
    return { status: "up", enabled: true, detail: "test cache" };
  },
  async close() {},
};

function matchesSnapshot(snapshotId: string, snapshotQuery: string) {
  return snapshotQuery === "published" ? true : snapshotId === snapshotQuery;
}

function compareSnapshotRecency(
  left: Pick<SnapshotDTO, "publishedAt" | "id"> | null,
  right: Pick<SnapshotDTO, "publishedAt" | "id"> | null,
) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || right.id.localeCompare(left.id);
}

function pickLatestSnapshot(snapshots: SnapshotDTO[]): SnapshotDTO | null {
  return [...snapshots].sort(compareSnapshotRecency)[0] ?? null;
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildSearchMatch(company: CompanyDetailDTO, query: string): CompanySearchMatchDTO | undefined {
  const normalizedQuery = normalizeSearchValue(query);
  const directCandidates: Array<{ field: CompanySearchMatchDTO["field"]; value?: string }> = [
    { field: "ticker", value: company.ticker },
    { field: "displayName", value: company.displayName },
    { field: "canonicalName", value: company.canonicalName },
    { field: "name", value: company.name },
  ];

  for (const candidate of directCandidates) {
    if (candidate.value && normalizeSearchValue(candidate.value).includes(normalizedQuery)) {
      return {
        field: candidate.field,
        value: candidate.value,
        explanation: `Matched ${candidate.field} "${candidate.value}".`,
      };
    }
  }

  const aliasRecords = [
    ...(company.entityProfile?.aliases ?? []),
    ...(company.entityProfile?.legalEntities ?? []),
    ...(company.entityProfile?.brands ?? []),
  ];

  for (const alias of aliasRecords) {
    if (normalizeSearchValue(alias.normalizedName || alias.name).includes(normalizedQuery)) {
      return {
        field: "alias",
        value: alias.name,
        aliasType: alias.aliasType,
        explanation: `Matched ${alias.aliasType} alias "${alias.name}" for canonical "${company.canonicalName ?? company.name}".`,
      };
    }
  }

  for (const alias of company.aliases) {
    if (normalizeSearchValue(alias).includes(normalizedQuery)) {
      return {
        field: "alias",
        value: alias,
        explanation: `Matched legacy alias "${alias}" for canonical "${company.canonicalName ?? company.name}".`,
      };
    }
  }

  return undefined;
}

function sortCompaniesForSearch(left: CompanyDetailDTO, right: CompanyDetailDTO, query: string) {
  const priority = ["ticker", "displayName", "canonicalName", "name", "alias"];
  const leftPriority = priority.indexOf(buildSearchMatch(left, query)?.field ?? "alias");
  const rightPriority = priority.indexOf(buildSearchMatch(right, query)?.field ?? "alias");

  return (
    leftPriority - rightPriority ||
    Number(right.isMag7) - Number(left.isMag7) ||
    (right.marketCapUsd ?? 0) - (left.marketCapUsd ?? 0) ||
    (left.displayName ?? left.name).localeCompare(right.displayName ?? right.name)
  );
}

function pickLatestRelationSnapshotId(relations: Array<Pick<RelationDTO, "snapshotId" | "lastVerifiedAt">>): string | null {
  return (
    [...relations]
      .sort(
        (left, right) =>
          (right.lastVerifiedAt ?? "").localeCompare(left.lastVerifiedAt ?? "") ||
          right.snapshotId.localeCompare(left.snapshotId),
      )[0]?.snapshotId ?? null
  );
}

function buildCompanyDetails(prepared: PreparedNormalizedImport) {
  const byId = new Map<string, CompanyDetailDTO>();
  const relationByCompany = new Map<string, { snapshotId: string; lastVerifiedAt: string | null }>();

  for (const edge of prepared.relationEdges) {
    const relation = prepared.relations.find((item) => item.id === edge.relationId);
    if (!relation) {
      continue;
    }

    const current = relationByCompany.get(edge.targetCompanyId);
    const next = {
      snapshotId: edge.snapshotId,
      lastVerifiedAt: relation.lastVerifiedAt,
    };

    if (!current || compareSnapshotRecency(
      { id: next.snapshotId, publishedAt: next.lastVerifiedAt },
      { id: current.snapshotId, publishedAt: current.lastVerifiedAt },
    ) < 0) {
      relationByCompany.set(edge.targetCompanyId, next);
    }
  }

  for (const company of prepared.companies) {
    const active = relationByCompany.get(company.id);
    byId.set(company.id, {
      ...company,
      primaryRegion: company.country,
      activeSnapshotId: active?.snapshotId ?? null,
      summary: company.description,
      lastUpdatedAt: active?.lastVerifiedAt ?? null,
    });
  }

  return byId;
}

function buildSubgraph(
  companyById: Map<string, CompanyDetailDTO>,
  prepared: PreparedNormalizedImport,
  relations: RelationDTO[],
): SubgraphDTO {
  const nodeMap = new Map<string, GraphNodeDTO>();

  for (const relation of relations) {
    const source = companyById.get(relation.sourceId);
    const target = companyById.get(relation.targetId);
    if (source) {
      nodeMap.set(source.id, {
        id: source.id,
        entityType: "Company",
        label: source.displayName ?? source.name,
        company: source,
        country: source.country,
        marketCapUsd: source.marketCapUsd,
        importanceScore: source.importanceScore,
      });
    }
    if (target) {
      nodeMap.set(target.id, {
        id: target.id,
        entityType: "Company",
        label: target.displayName ?? target.name,
        company: target,
        country: target.country,
        marketCapUsd: target.marketCapUsd,
        importanceScore: target.importanceScore,
      });
    }
  }

  const snapshot = pickLatestSnapshot(
    relations
      .map((relation) => prepared.snapshots.find((snapshotItem) => snapshotItem.id === relation.snapshotId) ?? null)
      .filter((snapshotItem): snapshotItem is PreparedNormalizedImport["snapshots"][number] => Boolean(snapshotItem)) as SnapshotDTO[],
  );

  return {
    snapshot:
      snapshot ?? {
        id: pickLatestRelationSnapshotId(relations) ?? "snapshot:published",
        version: (pickLatestRelationSnapshotId(relations) ?? "snapshot:published")
          .replace("snapshot:", "")
          .replace(/-/g, "."),
        status: "published" as const,
        publishedAt: null,
        scope: [],
        notes: null,
      },
    nodes: [...nodeMap.values()],
    relations,
  };
}

class RealSampleGraphRepository implements GraphRepository {
  source = "neo4j" as const;
  private readonly companyById: Map<string, CompanyDetailDTO>;
  private readonly evidenceByRelationId = new Map<string, EvidenceDTO[]>();
  private readonly relationById = new Map<string, RelationDTO>();

  constructor(private readonly prepared: PreparedNormalizedImport) {
    this.companyById = buildCompanyDetails(prepared);

    for (const relation of prepared.relations) {
      const hydratedRelation: RelationDTO = {
        ...relation,
        sourceId: prepared.relationEdges.find((edge) => edge.relationId === relation.id)?.sourceCompanyId ?? "",
        targetId: prepared.relationEdges.find((edge) => edge.relationId === relation.id)?.targetCompanyId ?? "",
        status: relation.status as RelationDTO["status"],
      };
      this.relationById.set(relation.id, hydratedRelation);
    }

    for (const binding of prepared.evidenceBindings) {
      const evidenceNode = prepared.evidence.find((item) => item.id === binding.evidenceId);
      if (!evidenceNode) {
        continue;
      }

      const evidence: EvidenceDTO = {
        id: evidenceNode.id,
        sourceType: evidenceNode.sourceType,
        title: evidenceNode.title,
        publisher: evidenceNode.publisher,
        url: evidenceNode.url,
        publishedAt: evidenceNode.publishedAt,
        publishedAtResolution: evidenceNode.publishedAtResolution,
        coverageStart: evidenceNode.coverageStart,
        coverageEnd: evidenceNode.coverageEnd,
        coverageStartResolution: evidenceNode.coverageStartResolution,
        coverageEndResolution: evidenceNode.coverageEndResolution,
        retrievedAt: evidenceNode.retrievedAt,
        excerpt: evidenceNode.excerpt,
        pageRef: evidenceNode.pageRef,
        language: evidenceNode.language,
        hash: evidenceNode.hash,
        sourceDomain: evidenceNode.sourceDomain,
        citationText: evidenceNode.citationText,
        reliabilityTier: evidenceNode.reliabilityTier,
        licenseNote: evidenceNode.licenseNote,
        parserVersion: evidenceNode.parserVersion,
      };

      const current = this.evidenceByRelationId.get(binding.relationId) ?? [];
      current.push(evidence);
      this.evidenceByRelationId.set(binding.relationId, current);
    }
  }

  async listCompanies(query: CompanyListQuery) {
    const normalized = query.q?.toLowerCase();
    return [...this.companyById.values()]
      .filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7))
      .filter((company) => {
        if (!normalized) {
          return true;
        }

        return (
          company.name.toLowerCase().includes(normalized) ||
          company.displayName?.toLowerCase().includes(normalized) ||
          company.ticker?.toLowerCase().includes(normalized) ||
          company.aliases.some((alias) => alias.toLowerCase().includes(normalized))
        );
      })
      .sort((left, right) => Number(right.isMag7) - Number(left.isMag7) || left.name.localeCompare(right.name))
      .map((company) => ({
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        canonicalName: company.canonicalName,
        displayName: company.displayName,
        isMag7: company.isMag7,
        marketCapUsd: company.marketCapUsd,
        entityProfile: company.entityProfile,
        primaryRegion: company.primaryRegion,
        activeSnapshotId: company.activeSnapshotId,
      }));
  }

  async searchCompanies(query: SearchCompaniesQuery) {
    return [...this.companyById.values()]
      .filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7))
      .filter((company) => Boolean(buildSearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => ({
        id: company.id,
        ticker: company.ticker,
        name: company.name,
        isMag7: company.isMag7,
        marketCapUsd: company.marketCapUsd,
        primaryRegion: company.primaryRegion,
        activeSnapshotId: company.activeSnapshotId,
        canonicalName: company.canonicalName,
        displayName: company.displayName,
        entityProfile: company.entityProfile,
        match: buildSearchMatch(company, query.q),
      }));
  }

  async suggestCompanies(query: SuggestCompaniesQuery) {
    return [...this.companyById.values()]
      .filter((company) => Boolean(buildSearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => ({
        id: company.id,
        label: company.ticker ? `${company.displayName ?? company.name} (${company.ticker})` : (company.displayName ?? company.name),
        secondaryLabel:
          company.canonicalName && company.canonicalName !== company.displayName
            ? company.canonicalName
            : undefined,
        ticker: company.ticker,
        isMag7: company.isMag7,
        canonicalName: company.canonicalName,
        displayName: company.displayName,
        entityProfile: company.entityProfile,
        match: buildSearchMatch(company, query.q),
      }));
  }

  async getCompany(companyId: string) {
    return this.companyById.get(companyId) ?? null;
  }

  async getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO | null> {
    const company = this.companyById.get(companyId);
    if (!company) {
      return null;
    }

    const relatedRelations = [...this.relationById.values()].filter(
      (relation) => relation.sourceId === companyId || relation.targetId === companyId,
    );

    return {
      companyId,
      companyName: company.name,
      activeSnapshotId: company.activeSnapshotId,
      totalRelations: relatedRelations.length,
      tier1SupplierCount: relatedRelations.filter((relation) => relation.tier === 1).length,
      supplierCount: new Set(relatedRelations.map((relation) => relation.sourceId)).size,
      highRiskRelationCount: relatedRelations.filter((relation) => relation.confidence !== "confirmed").length,
      evidenceCount: relatedRelations.reduce((sum, relation) => sum + relation.evidenceCount, 0),
      evidenceCoverage:
        relatedRelations.length === 0
          ? 0
          : relatedRelations.filter((relation) => relation.evidenceCount > 0).length / relatedRelations.length,
      lastUpdatedAt: company.lastUpdatedAt ?? null,
      source: this.source,
    };
  }

  async getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO> {
    const rootCompany = this.companyById.get(query.companyId) ?? null;
    const relations = [...this.relationById.values()]
      .filter((relation) => relation.depthFromMag7 <= query.depth)
      .filter((relation) => matchesSnapshot(relation.snapshotId, query.snapshot))
      .filter((relation) => !query.relationshipTypes || query.relationshipTypes.includes(relation.relationshipType))
      .filter((relation) => relation.sourceId === query.companyId || relation.targetId === query.companyId)
      .map((relation) => ({
        ...relation,
        evidence: query.includeEvidence ? this.evidenceByRelationId.get(relation.id) ?? [] : undefined,
      }));

    if (relations.length === 0) {
      return {
        snapshot: {
          id: rootCompany?.activeSnapshotId ?? "snapshot:published",
          version: (rootCompany?.activeSnapshotId ?? "snapshot:published").replace("snapshot:", "").replace(/-/g, "."),
          status: "published" as const,
          publishedAt: null,
          scope: rootCompany ? [rootCompany.id] : [],
          notes: "No matching relations for this snapshot filter.",
        },
        nodes: rootCompany
          ? [{
              id: rootCompany.id,
              entityType: "Company" as const,
              label: rootCompany.displayName ?? rootCompany.name,
              company: rootCompany,
              country: rootCompany.country,
              marketCapUsd: rootCompany.marketCapUsd,
              importanceScore: rootCompany.importanceScore,
            }]
          : [],
        relations: [],
      };
    }

    return buildSubgraph(this.companyById, this.prepared, relations);
  }

  async getPath(query: GraphPathQuery): Promise<SubgraphDTO> {
    const directRelations = [...this.relationById.values()]
      .filter((relation) => relation.depthFromMag7 <= query.maxDepth)
      .filter((relation) => matchesSnapshot(relation.snapshotId, query.snapshot))
      .filter(
        (relation) =>
          (relation.sourceId === query.sourceCompanyId && relation.targetId === query.targetCompanyId) ||
          (relation.sourceId === query.targetCompanyId && relation.targetId === query.sourceCompanyId),
      )
      .map((relation) => ({
        ...relation,
        evidence: query.includeEvidence ? this.evidenceByRelationId.get(relation.id) ?? [] : undefined,
      }));

    return directRelations.length === 0
      ? {
          snapshot: {
            id: "snapshot:published",
            version: "published",
            status: "published" as const,
            publishedAt: null,
            scope: [],
            notes: "No path found.",
          },
          nodes: [],
          relations: [],
        }
      : buildSubgraph(this.companyById, this.prepared, directRelations);
  }

  async getGraphStats(query: GraphStatsQuery): Promise<GraphStatsDTO> {
    const scopedRelations = [...this.relationById.values()].filter(
      (relation) =>
        matchesSnapshot(relation.snapshotId, query.snapshot) &&
        (!query.companyId || relation.sourceId === query.companyId || relation.targetId === query.companyId),
    );

    const companyIds = new Set<string>();
    const mag7Ids = new Set<string>();
    const relationshipTypeBreakdown: Record<string, number> = {};
    const confidenceBreakdown: Record<string, number> = {};
    const evidenceIds = new Set<string>();

    for (const relation of scopedRelations) {
      companyIds.add(relation.sourceId);
      companyIds.add(relation.targetId);
      if (this.companyById.get(relation.sourceId)?.isMag7) {
        mag7Ids.add(relation.sourceId);
      }
      if (this.companyById.get(relation.targetId)?.isMag7) {
        mag7Ids.add(relation.targetId);
      }
      relationshipTypeBreakdown[relation.relationshipType] =
        (relationshipTypeBreakdown[relation.relationshipType] ?? 0) + 1;
      confidenceBreakdown[relation.confidence] = (confidenceBreakdown[relation.confidence] ?? 0) + 1;
      for (const evidenceId of relation.evidenceIds) {
        evidenceIds.add(evidenceId);
      }
    }

    const snapshot = pickLatestSnapshot(
      scopedRelations
        .map((relation) => this.prepared.snapshots.find((snapshotItem) => snapshotItem.id === relation.snapshotId) ?? null)
        .filter((snapshot): snapshot is PreparedNormalizedImport["snapshots"][number] => Boolean(snapshot)) as SnapshotDTO[],
    );

    return {
      snapshot,
      companyCount: companyIds.size,
      relationCount: scopedRelations.length,
      evidenceCount: evidenceIds.size,
      mag7CompanyCount: mag7Ids.size,
      relationshipTypeBreakdown,
      confidenceBreakdown,
      source: this.source,
    };
  }

  async getRelationEvidence(relationId: string) {
    return this.evidenceByRelationId.get(relationId) ?? [];
  }

  async importNormalizedPackage(payload: PreparedNormalizedImport) {
    return {
      companyCount: payload.companies.length,
      relationCount: payload.relations.length,
      evidenceCount: payload.evidence.length,
      snapshotCount: payload.snapshots.length,
    };
  }
}

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  const pkg = await loadNormalizedImportPackage(
    `${FULL_PACKAGE_DIR}/relations.jsonl`,
    `${FULL_PACKAGE_DIR}/evidence.jsonl`,
  );
  const prepared = prepareNormalizedImport(pkg);
  const graphRepository = new RealSampleGraphRepository(prepared);
  const neo4jHealth = async (): Promise<Neo4jHealth> => ({
    status: "up",
    detail: "full-package sample repository",
  });

  app = await buildApp({
    cacheClient,
    graphRepository,
    neo4jHealth,
  });
});

beforeEach(() => {
  cache.clear();
});

afterAll(async () => {
  await app?.close();
});

describe("full package app", () => {
  it("serves detail, overview, and subgraph for all 7 Mag7 companies from the full package", async () => {
    for (const companyId of MAG7_COMPANY_IDS) {
      const [detail, overview, subgraph, stats] = await Promise.all([
        app.inject({ method: "GET", url: `/api/v1/companies/${encodeURIComponent(companyId)}` }),
        app.inject({ method: "GET", url: `/api/v1/companies/${encodeURIComponent(companyId)}/overview` }),
        app.inject({
          method: "GET",
          url: `/api/v1/graph/subgraph?companyId=${encodeURIComponent(companyId)}&depth=3&snapshot=published&includeEvidence=true`,
        }),
        app.inject({
          method: "GET",
          url: `/api/v1/graph/stats?snapshot=published&companyId=${encodeURIComponent(companyId)}`,
        }),
      ]);

      expect(detail.statusCode).toBe(200);
      expect(overview.statusCode).toBe(200);
      expect(subgraph.statusCode).toBe(200);
      expect(stats.statusCode).toBe(200);
      expect(detail.headers["x-cache"]).toBe("miss");
      expect(overview.headers["x-cache"]).toBe("miss");
      expect(detail.json().item.id).toBe(companyId);
      expect(overview.json().companyId).toBe(companyId);
      expect(subgraph.json().relations.length).toBeGreaterThan(0);
      expect(stats.json().relationCount).toBeGreaterThan(0);
    }
  });

  it("keeps Alphabet detail, overview, subgraph, and stats pinned to the latest published snapshot", async () => {
    const [detail, overview, subgraph, stats] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/companies/company:GOOGL" }),
      app.inject({ method: "GET", url: "/api/v1/companies/company:GOOGL/overview" }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:GOOGL&depth=3&snapshot=published&includeEvidence=true",
      }),
      app.inject({ method: "GET", url: "/api/v1/graph/stats?snapshot=published&companyId=company:GOOGL" }),
    ]);

    expect(detail.statusCode).toBe(200);
    expect(overview.statusCode).toBe(200);
    expect(subgraph.statusCode).toBe(200);
    expect(stats.statusCode).toBe(200);

    expect(detail.json().item.activeSnapshotId).toBe("snapshot:2026-06-14.3");
    expect(overview.json().activeSnapshotId).toBe("snapshot:2026-06-14.3");
    expect(subgraph.json().snapshot).toMatchObject({
      id: "snapshot:2026-06-14.3",
      version: "2026.06.14.3",
    });
    expect(stats.json().snapshot).toMatchObject({
      id: "snapshot:2026-06-14.3",
      version: "2026.06.14.3",
    });
  });

  it("serves real search, suggest, path, stats, and evidence payloads from the full package", async () => {
    const [list, search, suggest, path, stats, evidence] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/companies?q=amazon&page=1&pageSize=5" }),
      app.inject({ method: "GET", url: "/api/v1/companies/search?q=amazon&limit=5" }),
      app.inject({ method: "GET", url: "/api/v1/companies/suggest?q=tes&limit=5" }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=true",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/stats?snapshot=published&companyId=company:AMZN",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/relations/rel:apple:tsmc:manufacturing:apple-silicon/evidence",
      }),
    ]);

    expect(list.statusCode).toBe(200);
    expect(list.json().items.some((item: { id: string }) => item.id === "company:AMZN")).toBe(true);
    expect(list.json().items[0]).toMatchObject({
      canonicalName: "Amazon",
      displayName: "Amazon",
      entityProfile: {
        canonicalName: "Amazon",
        displayName: "Amazon",
      },
    });

    expect(search.statusCode).toBe(200);
    expect(search.json().items.some((item: { id: string }) => item.id === "company:AMZN")).toBe(true);
    expect(search.json().items[0]).toMatchObject({
      canonicalName: "Amazon",
      displayName: "Amazon",
      entityProfile: {
        canonicalName: "Amazon",
        displayName: "Amazon",
      },
      match: {
        field: expect.any(String),
        explanation: expect.stringContaining("canonical"),
      },
    });

    expect(suggest.statusCode).toBe(200);
    expect(suggest.json().items.some((item: { id: string }) => item.id === "company:TSLA")).toBe(true);
    expect(suggest.json().items[0]).toMatchObject({
      canonicalName: "Tesla",
      displayName: "Tesla",
      entityProfile: {
        canonicalName: "Tesla",
        displayName: "Tesla",
      },
      match: {
        field: expect.any(String),
        explanation: expect.any(String),
      },
    });

    expect(path.statusCode).toBe(200);
    expect(path.json().relations[0].id).toBe("rel:apple:tsmc:manufacturing:apple-silicon");

    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({
      source: "neo4j",
    });
    expect(stats.json().relationCount).toBeGreaterThan(0);

    expect(evidence.statusCode).toBe(200);
    expect(evidence.json()).toMatchObject({
      relationId: "rel:apple:tsmc:manufacturing:apple-silicon",
      total: 2,
      source: "neo4j",
    });
  });

  it("reuses Redis-style cache keys for companies list/detail/overview/search/suggest and graph queries", async () => {
    const requests = [
      "/api/v1/companies?isMag7=true&page=1&pageSize=7",
      "/api/v1/companies/company:AAPL",
      "/api/v1/companies/company:AAPL/overview",
      "/api/v1/companies/search?q=amazon&limit=5",
      "/api/v1/companies/suggest?q=tes&limit=5",
      "/api/v1/graph/subgraph?companyId=company:AAPL&depth=2&snapshot=published&includeEvidence=false",
      "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=2&snapshot=published&includeEvidence=false",
      "/api/v1/graph/stats?snapshot=published&companyId=company:AAPL",
    ];

    for (const url of requests) {
      const first = await app.inject({ method: "GET", url });
      const second = await app.inject({ method: "GET", url });

      expect(first.statusCode).toBe(200);
      expect(first.headers["x-cache"]).toBe("miss");
      expect(second.headers["x-cache"]).toBe("hit");
    }
  });

  it("maps ceo-reported malformed query inputs to 400 in full-package mode", async () => {
    const [search, suggest, path] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/companies/search?limit=5" }),
      app.inject({ method: "GET", url: "/api/v1/companies/suggest?limit=5" }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:TSMC&targetCompanyId=company:AAPL&maxDepth=0&snapshot=published",
      }),
    ]);

    for (const response of [search, suggest, path]) {
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "bad_request",
        message: "Invalid request parameters.",
      });
    }

    expect(search.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "q" })]),
    );
    expect(suggest.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "q" })]),
    );
    expect(path.json().details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "maxDepth" })]),
    );
  });
});
