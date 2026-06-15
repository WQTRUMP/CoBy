import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
  type ImportRelationNode,
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
const FULL_PACKAGE_MANIFEST = `${FULL_PACKAGE_DIR}/mag7-full-package-manifest.json`;
const ROUND19_REFRESH_PACKAGE_DIR = `${FULL_PACKAGE_DIR}/round19-aagt-refresh`;
const ROUND19_REFRESH_MANIFEST = `${ROUND19_REFRESH_PACKAGE_DIR}/mag7-full-package-manifest.json`;
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
    return { status: "up", enabled: true, detail: "test cache", required: true };
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
        skuGranularityDetail:
          relation.skuGranularityDetailValue && relation.skuGranularitySource
            ? {
                value: relation.skuGranularityDetailValue,
                source: relation.skuGranularitySource,
                raw: relation.skuGranularityRaw,
                note: relation.skuGranularityNote,
                isBackfilled: relation.skuGranularityIsBackfilled,
              }
            : null,
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
        skuGranularity: evidenceNode.skuGranularity,
        skuGranularityDetail:
          evidenceNode.skuGranularityDetailValue && evidenceNode.skuGranularitySource
            ? {
                value: evidenceNode.skuGranularityDetailValue,
                source: evidenceNode.skuGranularitySource,
                raw: evidenceNode.skuGranularityRaw,
                note: evidenceNode.skuGranularityNote,
                isBackfilled: evidenceNode.skuGranularityIsBackfilled,
              }
            : null,
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
    const directEvidence = this.evidenceByRelationId.get(relationId);
    if (directEvidence && directEvidence.length > 0) {
      return [...directEvidence].sort(
        (left, right) =>
          (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || left.id.localeCompare(right.id),
      );
    }

    const relation = this.relationById.get(relationId);
    if (!relation) {
      return [];
    }

    const fallbackEvidenceIds =
      relation.evidenceIds.length > 0
        ? relation.evidenceIds
        : relation.primaryEvidenceId
          ? [relation.primaryEvidenceId]
          : [];

    return fallbackEvidenceIds
      .map((evidenceId) => this.prepared.evidence.find((item) => item.id === evidenceId) ?? null)
      .filter((item): item is PreparedNormalizedImport["evidence"][number] => Boolean(item))
      .map((evidenceNode) => ({
        id: evidenceNode.id,
        sourceType: evidenceNode.sourceType,
        skuGranularity: evidenceNode.skuGranularity,
        skuGranularityDetail:
          evidenceNode.skuGranularityDetailValue && evidenceNode.skuGranularitySource
            ? {
                value: evidenceNode.skuGranularityDetailValue,
                source: evidenceNode.skuGranularitySource,
                raw: evidenceNode.skuGranularityRaw,
                note: evidenceNode.skuGranularityNote,
                isBackfilled: evidenceNode.skuGranularityIsBackfilled,
              }
            : null,
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
      }))
      .sort(
        (left, right) =>
          (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || left.id.localeCompare(right.id),
      );
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
let round19App: Awaited<ReturnType<typeof buildApp>>;
let latestPublishedSnapshotId = "snapshot:published";
let latestPublishedSnapshotVersion = "published";
let preparedFullPackage: PreparedNormalizedImport;
let round19PublishedSnapshotId = "snapshot:published";
let round19PublishedSnapshotVersion = "published";
let preparedRound19Package: PreparedNormalizedImport;

async function buildSampleAppFromPackage(
  packageDir: string,
  manifestPath: string,
  snapshotSelector: "package" | "authoritative" = "package",
) {
  const [pkg, manifestRaw] = await Promise.all([
    loadNormalizedImportPackage(`${packageDir}/relations.jsonl`, `${packageDir}/evidence.jsonl`),
    readFile(manifestPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw) as {
    package_snapshot_id?: string;
    authoritative_snapshot?: string;
  };
  const snapshotId =
    (snapshotSelector === "authoritative" ? manifest.authoritative_snapshot : manifest.package_snapshot_id) ??
    manifest.authoritative_snapshot ??
    manifest.package_snapshot_id ??
    "snapshot:published";
  const snapshotVersion = snapshotId.replace("snapshot:", "").replace(/-/g, ".");
  const prepared = prepareNormalizedImport(pkg);
  const graphRepository = new RealSampleGraphRepository(prepared);
  const neo4jHealth = async (): Promise<Neo4jHealth> => ({
    status: "up",
    detail: "full-package sample repository",
    required: true,
  });

  return {
    app: await buildApp({
      cacheClient,
      graphRepository,
      neo4jHealth,
      runtimeMode: "live",
    }),
    prepared,
    snapshotId,
    snapshotVersion,
  };
}

beforeAll(async () => {
  const [fullPackageHarness, round19Harness] = await Promise.all([
    buildSampleAppFromPackage(FULL_PACKAGE_DIR, FULL_PACKAGE_MANIFEST, "authoritative"),
    buildSampleAppFromPackage(ROUND19_REFRESH_PACKAGE_DIR, ROUND19_REFRESH_MANIFEST),
  ]);
  app = fullPackageHarness.app;
  preparedFullPackage = fullPackageHarness.prepared;
  latestPublishedSnapshotId = fullPackageHarness.snapshotId;
  latestPublishedSnapshotVersion = fullPackageHarness.snapshotVersion;
  round19App = round19Harness.app;
  preparedRound19Package = round19Harness.prepared;
  round19PublishedSnapshotId = round19Harness.snapshotId;
  round19PublishedSnapshotVersion = round19Harness.snapshotVersion;
});

beforeEach(() => {
  cache.clear();
});

afterAll(async () => {
  await app?.close();
  await round19App?.close();
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

    expect(detail.json().item.activeSnapshotId).toBe(latestPublishedSnapshotId);
    expect(overview.json().activeSnapshotId).toBe(latestPublishedSnapshotId);
    expect(subgraph.json().snapshot).toMatchObject({
      id: latestPublishedSnapshotId,
      version: latestPublishedSnapshotVersion,
    });
    expect(stats.json().snapshot).toMatchObject({
      id: latestPublishedSnapshotId,
      version: latestPublishedSnapshotVersion,
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
    expect(list.json().items.find((item: { id: string }) => item.id === "company:AMZN")).toMatchObject({
      canonicalName: "Amazon",
      displayName: "Amazon",
      entityProfile: {
        canonicalName: "Amazon",
        displayName: "Amazon",
      },
    });

    expect(search.statusCode).toBe(200);
    expect(search.json().items.some((item: { id: string }) => item.id === "company:AMZN")).toBe(true);
    expect(search.json().items.find((item: { id: string }) => item.id === "company:AMZN")).toMatchObject({
      canonicalName: "Amazon",
      displayName: "Amazon",
      entityProfile: {
        canonicalName: "Amazon",
        displayName: "Amazon",
      },
      match: {
        field: expect.any(String),
        explanation: expect.any(String),
      },
    });

    expect(suggest.statusCode).toBe(200);
    expect(suggest.json().items.some((item: { id: string }) => item.id === "company:TSLA")).toBe(true);
    expect(suggest.json().items.find((item: { id: string }) => item.id === "company:TSLA")).toMatchObject({
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

  it("keeps the latest published NVIDIA counts stable while structuring sku granularity from the authoritative snapshot", async () => {
    const [overview, subgraph, path, evidence] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/api/v1/companies/company:NVDA/overview",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:NVDA&depth=2&snapshot=published&includeEvidence=true",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:nvidia-mms4a20-800g-dr4-single-port-osfp-transceiver&targetCompanyId=company:NVDA&maxDepth=1&snapshot=published&includeEvidence=true",
      }),
      app.inject({
        method: "GET",
        url: "/api/v1/relations/rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver/evidence",
      }),
    ]);

    expect(overview.statusCode).toBe(200);
    expect(subgraph.statusCode).toBe(200);
    expect(path.statusCode).toBe(200);
    expect(evidence.statusCode).toBe(200);

    const relationById = new Map<string, ImportRelationNode>(
      preparedFullPackage.relations.map((relation) => [relation.id, relation]),
    );
    const expectedNvdaRelations = preparedFullPackage.relationEdges
      .filter((edge) => edge.sourceCompanyId === "company:NVDA" || edge.targetCompanyId === "company:NVDA")
      .flatMap((edge) => {
        const relation = relationById.get(edge.relationId);
        return relation ? [relation] : [];
      });
    const relationDetailFor = (relationId: string) => {
      const relation = relationById.get(relationId);
      return relation?.skuGranularityDetailValue && relation.skuGranularitySource
        ? {
            value: relation.skuGranularityDetailValue,
            source: relation.skuGranularitySource,
            raw: relation.skuGranularityRaw,
            note: relation.skuGranularityNote,
            isBackfilled: relation.skuGranularityIsBackfilled,
          }
        : null;
    };

    expect(overview.json()).toMatchObject({
      companyId: "company:NVDA",
      totalRelations: expectedNvdaRelations.length,
      evidenceCount: expectedNvdaRelations.reduce((sum, relation) => sum + relation.evidenceCount, 0),
      source: "neo4j",
    });
    expect(subgraph.json().relations.length).toBeGreaterThan(0);
    const subgraphRelationById = new Map(
      subgraph
        .json()
        .relations
        .map((relation: RelationDTO) => [relation.id, relation]),
    );
    expect(subgraphRelationById.get("rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver")).toMatchObject({
      skuGranularity:
        relationById.get("rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver")?.skuGranularity ??
        null,
      skuGranularityDetail: relationDetailFor(
        "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
      ),
    });
    expect(subgraphRelationById.get("rel:nvidia:mms4c1x-fro:component_supply:quantum-x800-qm3400-twin-port-dr4-transceiver")).toMatchObject({
      skuGranularity:
        relationById.get("rel:nvidia:mms4c1x-fro:component_supply:quantum-x800-qm3400-twin-port-dr4-transceiver")
          ?.skuGranularity ?? null,
      skuGranularityDetail: relationDetailFor(
        "rel:nvidia:mms4c1x-fro:component_supply:quantum-x800-qm3400-twin-port-dr4-transceiver",
      ),
    });
    expect(subgraphRelationById.get("rel:nvidia:linkx-fiber-topology:component_supply:quantum-x800-supported-fiber-topology")).toMatchObject({
      skuGranularity:
        relationById.get("rel:nvidia:linkx-fiber-topology:component_supply:quantum-x800-supported-fiber-topology")
          ?.skuGranularity ?? null,
      skuGranularityDetail: relationDetailFor(
        "rel:nvidia:linkx-fiber-topology:component_supply:quantum-x800-supported-fiber-topology",
      ),
    });

    expect(path.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
          skuGranularity:
            relationById.get("rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver")
              ?.skuGranularity ?? null,
          skuGranularityDetail: relationDetailFor(
            "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
          ),
        }),
      ]),
    );

    const expectedEvidence = preparedFullPackage.evidence.find((item) =>
      preparedFullPackage.evidenceBindings.some(
        (binding) =>
          binding.relationId === "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver" &&
          binding.evidenceId === item.id,
      ),
    );
    const expectedEvidenceSkuDetail =
      expectedEvidence?.skuGranularityDetailValue && expectedEvidence.skuGranularitySource
        ? {
            value: expectedEvidence.skuGranularityDetailValue,
            source: expectedEvidence.skuGranularitySource,
            raw: expectedEvidence.skuGranularityRaw,
            note: expectedEvidence.skuGranularityNote,
            isBackfilled: expectedEvidence.skuGranularityIsBackfilled,
          }
        : null;
    expect(evidence.json()).toMatchObject({
      relationId: "rel:nvidia:mms4a20:component_supply:quantum-x800-qm3x00-dr4-transceiver",
      total: 1,
      source: "neo4j",
      items: [
        expect.objectContaining({
          skuGranularity: expectedEvidence?.skuGranularity ?? null,
          skuGranularityDetail: expectedEvidenceSkuDetail,
        }),
      ],
    });
  });

  it("serves official_product_page evidence from the latest published full package", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/relations/rel:amazon:trn2-ultraserver:component_supply:efav3-scale-out-networking/evidence",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      relationId: "rel:amazon:trn2-ultraserver:component_supply:efav3-scale-out-networking",
      total: 1,
      source: "neo4j",
      items: [
        expect.objectContaining({
          id: "evidence:amazon:efav3:2026-06-15:amazon-ec2-trn2-instances:1",
          sourceType: "official_product_page",
          title: "Amazon EC2 Trn2 instances",
          sourceDomain: "aws.amazon.com",
          publishedAt: "2026-06-15",
        }),
      ],
    });
  });

  it("coalesces retrieved_at_only evidence into undated semantics in the full package API", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/relations/rel:tesla:nvidia:component_supply:autopilot-hw2-hw25-compute-platform/evidence",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      relationId: "rel:tesla:nvidia:component_supply:autopilot-hw2-hw25-compute-platform",
      total: 1,
      source: "neo4j",
      items: [
        expect.objectContaining({
          publishedAt: "2026-06-14",
          publishedAtResolution: "undated",
          retrievedAt: expect.any(String),
        }),
      ],
    });
    expect(response.json().items[0].publishedAtResolution).not.toBe("published_at");
  });

  it("keeps promoted full20-wave1 relation evidence reachable for NVIDIA Siemens and Tesla Panasonic Kansas", async () => {
    const repository = new RealSampleGraphRepository(preparedFullPackage);
    const [nvidiaSubgraph, nvidiaEvidence, teslaSubgraph, teslaEvidence] = await Promise.all([
      repository.getSubgraph({
        companyId: "company:NVDA",
        depth: 3,
        snapshot: "published",
        includeEvidence: true,
      }),
      repository.getRelationEvidence(
        "rel:nvidia:siemens:professional_service:n18-13-gb200_nvl72_power_and_automation_reference_architecture",
      ),
      repository.getSubgraph({
        companyId: "company:TSLA",
        depth: 3,
        snapshot: "published",
        includeEvidence: true,
      }),
      repository.getRelationEvidence(
        "rel:tesla:panasonic-energy-kansas-factory:manufacturing:battery-cell-manufacturing-2170-us-capacity-expansion",
      ),
    ]);

    expect(
      nvidiaSubgraph.relations.some(
        (relation) =>
          relation.id ===
          "rel:nvidia:siemens:professional_service:n18-13-gb200_nvl72_power_and_automation_reference_architecture",
      ),
    ).toBe(true);
    expect(
      teslaSubgraph.relations.some(
        (relation) =>
          relation.id ===
          "rel:tesla:panasonic-energy-kansas-factory:manufacturing:battery-cell-manufacturing-2170-us-capacity-expansion",
      ),
    ).toBe(true);

    expect(nvidiaEvidence.map((item) => item.id)).toEqual([
      "evidence:nvidia:siemens:2026-02-01:N18-13:2",
      "evidence:nvidia:siemens:2025-12-03:N18-13:1",
    ]);
    expect(teslaEvidence.map((item) => item.id)).toEqual([
      "evidence:tesla:panasonic-energy-kansas-factory:battery-cell-manufacturing-2170-us-capacity-expansion:2",
      "evidence:tesla:panasonic-energy-kansas-factory:battery-cell-manufacturing-2170-us-capacity-expansion:1",
    ]);
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

  it("direct-loads round19 candidate published raw without regressing Apple detail, overview, subgraph, path, stats, or evidence", async () => {
    const relationId = "rel:apple:ups:logistics:global-launch-air-hub";
    const [detail, overview, subgraph, path, stats, evidence] = await Promise.all([
      round19App.inject({ method: "GET", url: "/api/v1/companies/company:AAPL" }),
      round19App.inject({ method: "GET", url: "/api/v1/companies/company:AAPL/overview" }),
      round19App.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:AAPL&depth=3&snapshot=published&includeEvidence=true",
      }),
      round19App.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:ups&targetCompanyId=company:AAPL&maxDepth=1&snapshot=published&includeEvidence=true",
      }),
      round19App.inject({
        method: "GET",
        url: "/api/v1/graph/stats?snapshot=published&companyId=company:AAPL",
      }),
      round19App.inject({
        method: "GET",
        url: `/api/v1/relations/${encodeURIComponent(relationId)}/evidence`,
      }),
    ]);

    for (const response of [detail, overview, subgraph, path, stats, evidence]) {
      expect(response.statusCode).toBe(200);
    }

    expect(detail.json().item.id).toBe("company:AAPL");
    expect(overview.json().companyId).toBe("company:AAPL");
    expect(subgraph.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: relationId,
          sourceId: "company:ups",
          targetId: "company:AAPL",
          snapshotId: round19PublishedSnapshotId,
          tier: 1,
        }),
      ]),
    );
    expect(path.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: relationId,
          sourceId: "company:ups",
          targetId: "company:AAPL",
          snapshotId: round19PublishedSnapshotId,
          tier: 1,
        }),
      ]),
    );
    expect(stats.json().relationCount).toBeGreaterThan(0);
    expect(evidence.json()).toMatchObject({
      relationId,
      total: 1,
      source: "neo4j",
      items: [
        expect.objectContaining({
          sourceType: "official_press_release",
          publishedAt: "2020-10-23",
        }),
      ],
    });
    expect(round19PublishedSnapshotVersion).toBe("2026.06.15.full.19.candidate");
  });

  it("keeps round19 candidate published counts and late-tail Tesla evidence reachable after compatibility coercion", async () => {
    const relationId = "rel:tesla:redwood-materials:materials_supply:recycled-copper-foil-via-panasonic-nevada";
    const [subgraph, path, evidence] = await Promise.all([
      round19App.inject({
        method: "GET",
        url: "/api/v1/graph/subgraph?companyId=company:TSLA&depth=3&snapshot=published&includeEvidence=true",
      }),
      round19App.inject({
        method: "GET",
        url: "/api/v1/graph/path?sourceCompanyId=company:redwood-materials&targetCompanyId=company:TSLA&maxDepth=3&snapshot=published&includeEvidence=true",
      }),
      round19App.inject({
        method: "GET",
        url: `/api/v1/relations/${encodeURIComponent(relationId)}/evidence`,
      }),
    ]);

    expect(preparedRound19Package.relations).toHaveLength(327);
    expect(preparedRound19Package.evidence).toHaveLength(435);
    expect(round19PublishedSnapshotId).toBe("snapshot:2026-06-15.full.19-candidate");

    expect(subgraph.statusCode).toBe(200);
    expect(path.statusCode).toBe(200);
    expect(evidence.statusCode).toBe(200);
    expect(subgraph.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: relationId,
          sourceId: "company:redwood-materials",
          targetId: "company:TSLA",
          snapshotId: round19PublishedSnapshotId,
          tier: 3,
        }),
      ]),
    );
    expect(path.json().relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: relationId,
          sourceId: "company:redwood-materials",
          targetId: "company:TSLA",
          snapshotId: round19PublishedSnapshotId,
          tier: 3,
        }),
      ]),
    );
    expect(evidence.json()).toMatchObject({
      relationId,
      total: 3,
      source: "neo4j",
      items: expect.arrayContaining([
        expect.objectContaining({
          sourceType: "official_press_release",
          publishedAt: "2022-11-15",
        }),
      ]),
    });
  });
});
