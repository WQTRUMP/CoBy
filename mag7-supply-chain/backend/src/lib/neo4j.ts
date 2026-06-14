import neo4j, { type Driver } from "neo4j-driver";

import { env, type AppEnv } from "../config/env.js";
import type {
  CompanyDetailDTO,
  CompanyListItemDTO,
  CompanyListQuery,
  CompanyOverviewDTO,
  CompanySearchMatchDTO,
  CompanySearchResultItemDTO,
  CompanySuggestItemDTO,
  EvidenceDTO,
  GraphPathQuery,
  GraphStatsDTO,
  GraphStatsQuery,
  RelationDTO,
  SearchCompaniesQuery,
  SubgraphDTO,
  SubgraphQuery,
  SuggestCompaniesQuery,
} from "@mag7/contracts";
import { mockCompanies, mockSubgraph } from "./mock-data.js";
import type { PreparedNormalizedImport } from "./normalized-package.js";
import {
  DependencyUnavailableError,
  isNeo4jUnavailableError,
  toDependencyDetail,
} from "./dependency-failures.js";

export type DependencyStatus = "up" | "down" | "not_configured";
export type RuntimeMode = AppEnv["GRAPH_RUNTIME_MODE"];

export interface Neo4jHealth {
  status: DependencyStatus;
  detail: string;
  required: boolean;
}

export interface GraphRepository {
  source: "neo4j" | "mock";
  listCompanies(query: CompanyListQuery): Promise<CompanyListItemDTO[]>;
  searchCompanies(query: SearchCompaniesQuery): Promise<CompanySearchResultItemDTO[]>;
  suggestCompanies(query: SuggestCompaniesQuery): Promise<CompanySuggestItemDTO[]>;
  getCompany(companyId: string): Promise<CompanyDetailDTO | null>;
  getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO | null>;
  getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO>;
  getPath(query: GraphPathQuery): Promise<SubgraphDTO>;
  getGraphStats(query: GraphStatsQuery): Promise<GraphStatsDTO>;
  getRelationEvidence(relationId: string): Promise<EvidenceDTO[]>;
  importNormalizedPackage(payload: PreparedNormalizedImport): Promise<{
    companyCount: number;
    relationCount: number;
    evidenceCount: number;
    snapshotCount: number;
  }>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function mapCompanyToGraphNode(company: CompanyDetailDTO): SubgraphDTO["nodes"][number] {
  return {
    id: company.id,
    entityType: "Company",
    label: company.displayName ?? company.name,
    company,
    country: company.country,
    marketCapUsd: company.marketCapUsd,
    importanceScore: company.importanceScore,
  };
}

function createSnapshotFallback(snapshot: string, fallbackId: string | null): SubgraphDTO["snapshot"] {
  const id = snapshot === "published" ? fallbackId ?? "snapshot:published" : snapshot;
  return {
    id,
    version: id.replace("snapshot:", "").replace(/-/g, "."),
    status: "published",
    publishedAt: null,
    scope: [],
    notes: "No matching relations returned for the requested snapshot filter.",
  };
}

function mapSnapshotProperties(properties: Record<string, unknown>): SubgraphDTO["snapshot"] {
  return {
    id: String(properties.id),
    version: String(properties.version),
    status: String(properties.status) as SubgraphDTO["snapshot"]["status"],
    publishedAt: typeof properties.publishedAt === "string" ? properties.publishedAt : null,
    scope: toStringArray(properties.scope),
    notes: typeof properties.notes === "string" ? properties.notes : null,
  };
}

function sortSnapshotsByRecency<
  T extends {
    publishedAt: string | null;
    id: string;
  },
>(left: T, right: T) {
  return (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || right.id.localeCompare(left.id);
}

function pickLatestSnapshot(
  snapshots: Array<{ properties?: Record<string, unknown> } | null>,
): SubgraphDTO["snapshot"] | null {
  return snapshots
    .filter((item): item is { properties: Record<string, unknown> } => Boolean(item?.properties))
    .map((item) => mapSnapshotProperties(item.properties))
    .sort(sortSnapshotsByRecency)[0] ?? null;
}

function mapRelationRecord(
  resultRecord: { get: (key: string) => unknown },
  companyMap: Map<string, SubgraphDTO["nodes"][number]>,
  includeEvidence: boolean,
): RelationDTO {
  const sourceNode = resultRecord.get("source") as { properties: Record<string, unknown> };
  const targetNode = resultRecord.get("target") as { properties: Record<string, unknown> };
  const relationNode = resultRecord.get("rel") as { properties: Record<string, unknown> };
  const sourceCompany = mapCompanyNode(sourceNode.properties);
  const targetCompany = mapCompanyNode(targetNode.properties);
  const relation = relationNode.properties;

  for (const company of [sourceCompany, targetCompany]) {
    companyMap.set(company.id, mapCompanyToGraphNode(company));
  }

  const evidence = (resultRecord.get("evidence") as Array<{ properties?: Record<string, unknown> } | null>)
    .filter((item): item is { properties: Record<string, unknown> } => Boolean(item?.properties))
    .map((item) => mapEvidenceProperties(item.properties));

  return {
    id: String(relation.id),
    sourceId: sourceCompany.id,
    targetId: targetCompany.id,
    relationshipType: String(relation.relationshipType) as RelationDTO["relationshipType"],
    tier: toNumber(relation.tier) ?? 1,
    depthFromMag7: toNumber(relation.depthFromMag7) ?? 1,
    confidence: String(relation.confidence) as RelationDTO["confidence"],
    confidenceScore: toNumber(relation.confidenceScore) ?? 0,
    summary: String(relation.summary),
    relationshipSubtype:
      typeof relation.relationshipSubtype === "string" ? relation.relationshipSubtype : null,
    productScope:
      Array.isArray(relation.productScope)
        ? relation.productScope.map((item: unknown) => String(item))
        : toStringArray(relation.productScope),
    notes: typeof relation.notes === "string" ? relation.notes : null,
    evidenceIds: toStringArray(relation.evidenceIds),
    primaryEvidenceId: typeof relation.primaryEvidenceId === "string" ? relation.primaryEvidenceId : null,
    evidenceCount: toNumber(relation.evidenceCount) ?? evidence.length,
    snapshotId: String(relation.snapshotId),
    status: String(relation.status) as RelationDTO["status"],
    sourceMethod: typeof relation.sourceMethod === "string" ? relation.sourceMethod : null,
    evidenceDate: typeof relation.evidenceDate === "string" ? relation.evidenceDate : null,
    evidenceDateResolution:
      typeof relation.evidenceDateResolution === "string"
        ? relation.evidenceDateResolution as RelationDTO["evidenceDateResolution"]
        : null,
    evidenceDateNormalized:
      typeof relation.evidenceDateNormalized === "string" ? relation.evidenceDateNormalized : null,
    evidenceDateIsNormalized: Boolean(relation.evidenceDateIsNormalized),
    sourceCount: toNumber(relation.sourceCount) ?? 0,
    lineageKey: typeof relation.lineageKey === "string" ? relation.lineageKey : null,
    lastVerifiedAt: typeof relation.lastVerifiedAt === "string" ? relation.lastVerifiedAt : null,
    validFrom: typeof relation.validFrom === "string" ? relation.validFrom : null,
    validFromResolution:
      typeof relation.validFromResolution === "string"
        ? relation.validFromResolution as RelationDTO["validFromResolution"]
        : null,
    validTo: typeof relation.validTo === "string" ? relation.validTo : null,
    validToResolution:
      typeof relation.validToResolution === "string"
        ? relation.validToResolution as RelationDTO["validToResolution"]
        : null,
    validityNote: typeof relation.validityNote === "string" ? relation.validityNote : null,
    evidence: includeEvidence ? evidence : undefined,
  };
}

function mapCompanyNode(properties: Record<string, unknown>): CompanyDetailDTO {
  const entityProfileJson = typeof properties.entityProfileJson === "string" ? properties.entityProfileJson : null;
  const entityProfile =
    typeof properties.entityProfile === "object" && properties.entityProfile !== null
      ? properties.entityProfile
      : entityProfileJson
        ? JSON.parse(entityProfileJson)
        : undefined;

  return {
    id: String(properties.id),
    ticker: typeof properties.ticker === "string" ? properties.ticker : undefined,
    name: String(properties.name),
    canonicalName: typeof properties.canonicalName === "string" ? properties.canonicalName : String(properties.name),
    displayName:
      typeof properties.displayName === "string"
        ? properties.displayName
        : typeof properties.name === "string"
          ? properties.name
          : String(properties.id),
    entityType: "Company",
    companyType: String(properties.companyType) as CompanyDetailDTO["companyType"],
    country: String(properties.country),
    isMag7: Boolean(properties.isMag7),
    marketCapUsd: toNumber(properties.marketCapUsd),
    description: typeof properties.description === "string" ? properties.description : null,
    aliases: toStringArray(properties.aliases),
    entityProfile: entityProfile as CompanyDetailDTO["entityProfile"],
    active: properties.active !== false,
    importanceScore: toNumber(properties.importanceScore) ?? 0.5,
    primaryRegion: typeof properties.primaryRegion === "string" ? properties.primaryRegion : String(properties.country),
    activeSnapshotId:
      typeof properties.activeSnapshotId === "string" ? properties.activeSnapshotId : null,
    summary:
      typeof properties.summary === "string"
        ? properties.summary
        : typeof properties.description === "string"
          ? properties.description
          : null,
    lastUpdatedAt: typeof properties.lastUpdatedAt === "string" ? properties.lastUpdatedAt : null,
  };
}

function toCompanyListItem(company: CompanyDetailDTO): CompanyListItemDTO {
  return {
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
  };
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildAliasExplanation(
  aliasType: CompanySearchMatchDTO["aliasType"],
  aliasValue: string,
  company: CompanyDetailDTO,
) {
  const aliasLabel =
    aliasType === "legal_entity"
      ? "legal entity"
      : aliasType === "brand"
        ? "brand"
        : aliasType === "facility"
          ? "facility"
          : aliasType === "historical"
            ? "historical alias"
            : aliasType === "search_hint"
              ? "search hint"
              : aliasType === "short_name"
                ? "short name"
                : "alias";

  return `Matched ${aliasLabel} "${aliasValue}" for canonical "${company.canonicalName ?? company.name}" and display "${company.displayName ?? company.name}".`;
}

function buildCompanySearchMatch(company: CompanyDetailDTO, query: string): CompanySearchMatchDTO | undefined {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return undefined;
  }

  const simpleCandidates: Array<{
    field: CompanySearchMatchDTO["field"];
    value: string | undefined;
    explanation: string;
  }> = [
    {
      field: "ticker",
      value: company.ticker,
      explanation: `Matched ticker "${company.ticker}".`,
    },
    {
      field: "displayName",
      value: company.displayName,
      explanation: `Matched display name "${company.displayName ?? company.name}" under canonical "${company.canonicalName ?? company.name}".`,
    },
    {
      field: "canonicalName",
      value: company.canonicalName,
      explanation: `Matched canonical entity "${company.canonicalName ?? company.name}".`,
    },
    {
      field: "name",
      value: company.name,
      explanation: `Matched company name "${company.name}".`,
    },
  ];

  for (const candidate of simpleCandidates) {
    if (!candidate.value) {
      continue;
    }

    if (normalizeSearchValue(candidate.value).includes(normalizedQuery)) {
      return {
        field: candidate.field,
        value: candidate.value,
        explanation: candidate.explanation,
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
        explanation: buildAliasExplanation(alias.aliasType, alias.name, company),
      };
    }
  }

  for (const alias of company.aliases) {
    if (normalizeSearchValue(alias).includes(normalizedQuery)) {
      return {
        field: "alias",
        value: alias,
        aliasType: null,
        explanation: `Matched legacy alias "${alias}" for canonical "${company.canonicalName ?? company.name}".`,
      };
    }
  }

  return undefined;
}

function toCompanySearchResultItem(company: CompanyDetailDTO, query: string): CompanySearchResultItemDTO {
  return {
    ...toCompanyListItem(company),
    match: buildCompanySearchMatch(company, query),
  };
}

function toCompanySuggestItem(company: CompanyDetailDTO, query: string): CompanySuggestItemDTO {
  const displayName = company.displayName ?? company.name;
  const canonicalName = company.canonicalName ?? company.name;

  return {
    id: company.id,
    label: company.ticker ? `${displayName} (${company.ticker})` : displayName,
    secondaryLabel: canonicalName === displayName ? undefined : canonicalName,
    ticker: company.ticker,
    isMag7: company.isMag7,
    canonicalName,
    displayName,
    entityProfile: company.entityProfile,
    match: buildCompanySearchMatch(company, query),
  };
}

function sortCompaniesForSearch(left: CompanyDetailDTO, right: CompanyDetailDTO, query: string) {
  const leftMatch = buildCompanySearchMatch(left, query);
  const rightMatch = buildCompanySearchMatch(right, query);
  const priority = ["ticker", "displayName", "canonicalName", "name", "alias"];

  const leftPriority = leftMatch ? priority.indexOf(leftMatch.field) : priority.length;
  const rightPriority = rightMatch ? priority.indexOf(rightMatch.field) : priority.length;

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

function mapEvidenceProperties(properties: Record<string, unknown>): EvidenceDTO {
  return {
    id: String(properties.id),
    sourceType: String(properties.sourceType) as EvidenceDTO["sourceType"],
    title: String(properties.title),
    publisher: String(properties.publisher),
    url: String(properties.url),
    publishedAt: String(properties.publishedAt),
    publishedAtResolution:
      typeof properties.publishedAtResolution === "string"
        ? properties.publishedAtResolution as EvidenceDTO["publishedAtResolution"]
        : "published_at",
    coverageStart: typeof properties.coverageStart === "string" ? properties.coverageStart : null,
    coverageEnd: typeof properties.coverageEnd === "string" ? properties.coverageEnd : null,
    coverageStartResolution:
      typeof properties.coverageStartResolution === "string"
        ? properties.coverageStartResolution as EvidenceDTO["coverageStartResolution"]
        : null,
    coverageEndResolution:
      typeof properties.coverageEndResolution === "string"
        ? properties.coverageEndResolution as EvidenceDTO["coverageEndResolution"]
        : null,
    retrievedAt: String(properties.retrievedAt),
    excerpt: String(properties.excerpt),
    pageRef: typeof properties.pageRef === "string" ? properties.pageRef : null,
    language: typeof properties.language === "string" ? properties.language : "en",
    hash: String(properties.hash),
    sourceDomain: typeof properties.sourceDomain === "string" ? properties.sourceDomain : "",
    citationText:
      typeof properties.citationText === "string"
        ? properties.citationText
        : String(properties.excerpt ?? ""),
    reliabilityTier: toNumber(properties.reliabilityTier) ?? 4,
    licenseNote: typeof properties.licenseNote === "string" ? properties.licenseNote : null,
    parserVersion: typeof properties.parserVersion === "string" ? properties.parserVersion : "neo4j",
  };
}

class MockGraphRepository implements GraphRepository {
  source = "mock" as const;

  async listCompanies(query: CompanyListQuery) {
    const normalized = query.q?.toLowerCase();
    return mockCompanies
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
      .map(toCompanyListItem);
  }

  async searchCompanies(query: SearchCompaniesQuery) {
    return mockCompanies
      .filter((company) => (query.isMag7 === undefined ? true : company.isMag7 === query.isMag7))
      .filter((company) => Boolean(buildCompanySearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => toCompanySearchResultItem(company, query.q));
  }

  async suggestCompanies(query: SuggestCompaniesQuery) {
    return mockCompanies
      .filter((company) => Boolean(buildCompanySearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => toCompanySuggestItem(company, query.q));
  }

  async getCompany(companyId: string) {
    return mockCompanies.find((company) => company.id === companyId) ?? null;
  }

  async getCompanyOverview(companyId: string) {
    const company = mockCompanies.find((item) => item.id === companyId);
    if (!company) {
      return null;
    }

    const relatedRelations = mockSubgraph.relations.filter(
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
      evidenceCount: relatedRelations.reduce(
        (sum, relation) => sum + (relation.evidenceCount ?? relation.evidence?.length ?? 0),
        0,
      ),
      evidenceCoverage:
        relatedRelations.length === 0
          ? 0
          : relatedRelations.filter((relation) => (relation.evidenceCount ?? relation.evidence?.length ?? 0) > 0).length /
            relatedRelations.length,
      lastUpdatedAt: mockSubgraph.snapshot.publishedAt,
      source: this.source,
    };
  }

  async getSubgraph(query: SubgraphQuery) {
    const filtered = {
      ...mockSubgraph,
      relations: mockSubgraph.relations.filter((relation: RelationDTO) => {
        const matchesCompany =
          relation.sourceId === query.companyId || relation.targetId === query.companyId;
        const matchesDepth = relation.depthFromMag7 <= query.depth;
        const matchesType =
          !query.relationshipTypes || query.relationshipTypes.includes(relation.relationshipType);

        return matchesCompany && matchesDepth && matchesType;
      }),
    };

    return query.includeEvidence
      ? filtered
      : {
          ...filtered,
          relations: filtered.relations.map(
            ({ evidence, ...relation }: RelationDTO) => relation,
          ),
        };
  }

  async getPath(query: GraphPathQuery) {
    const nodes = new Set([query.sourceCompanyId, query.targetCompanyId]);
    const relations = mockSubgraph.relations.filter((relation) => {
      const endpoints = [relation.sourceId, relation.targetId];
      return endpoints.some((id) => nodes.has(id));
    });

    return {
      ...mockSubgraph,
      relations: query.includeEvidence
        ? relations
        : relations.map(({ evidence, ...relation }) => relation),
    };
  }

  async getGraphStats() {
    const companyIds = new Set<string>();
    const relationshipTypeBreakdown: Record<string, number> = {};
    const confidenceBreakdown: Record<string, number> = {};

    for (const relation of mockSubgraph.relations) {
      companyIds.add(relation.sourceId);
      companyIds.add(relation.targetId);
      relationshipTypeBreakdown[relation.relationshipType] =
        (relationshipTypeBreakdown[relation.relationshipType] ?? 0) + 1;
      confidenceBreakdown[relation.confidence] = (confidenceBreakdown[relation.confidence] ?? 0) + 1;
    }

    return {
      snapshot: mockSubgraph.snapshot,
      companyCount: companyIds.size,
      relationCount: mockSubgraph.relations.length,
      evidenceCount: mockSubgraph.relations.reduce((sum, relation) => sum + relation.evidenceCount, 0),
      mag7CompanyCount: mockCompanies.filter((company) => company.isMag7).length,
      relationshipTypeBreakdown,
      confidenceBreakdown,
      source: this.source,
    };
  }

  async getRelationEvidence(relationId: string) {
    return mockSubgraph.relations.find((relation) => relation.id === relationId)?.evidence ?? [];
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

export class Neo4jGraphRepository implements GraphRepository {
  source = "neo4j" as const;

  constructor(private readonly driver: Driver, private readonly database: string) {}

  private async queryPublishedCompanies(query: string | null, isMag7?: boolean | null) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company)
        WHERE ($query IS NULL
          OR toLower(c.name) CONTAINS toLower($query)
          OR toLower(coalesce(c.canonicalName, "")) CONTAINS toLower($query)
          OR toLower(coalesce(c.displayName, "")) CONTAINS toLower($query)
          OR toLower(coalesce(c.ticker, "")) CONTAINS toLower($query)
          OR any(alias IN coalesce(c.aliases, []) WHERE toLower(alias) CONTAINS toLower($query))
          OR any(alias IN coalesce(c.searchAliases, []) WHERE toLower(alias) CONTAINS toLower($query)))
          AND ($isMag7 IS NULL OR c.isMag7 = $isMag7)
        OPTIONAL MATCH (c)<-[:TARGET_OF|SOURCE_OF]-(rel:SupplyRelation)<-[:CONTAINS]-(snapshot:Snapshot)
        WHERE snapshot.status = 'published'
        WITH c, snapshot
        ORDER BY snapshot.publishedAt DESC, snapshot.id DESC
        WITH c, collect(snapshot) AS snapshots
        WITH c, [snapshot IN snapshots WHERE snapshot IS NOT NULL] AS publishedSnapshots
        WHERE size(publishedSnapshots) > 0
        RETURN c {
          .*,
          primaryRegion: coalesce(c.primaryRegion, c.country),
          activeSnapshotId: head([snapshot IN publishedSnapshots | snapshot.id]),
          lastUpdatedAt: head([snapshot IN publishedSnapshots | snapshot.publishedAt]),
          aliases: coalesce(c.aliases, []),
          canonicalName: coalesce(c.canonicalName, c.name),
          displayName: coalesce(c.displayName, c.name),
          entityProfileJson: c.entityProfileJson,
          searchAliases: coalesce(c.searchAliases, []),
          summary: coalesce(c.summary, c.description)
        } AS company
        `,
        { query, isMag7: isMag7 ?? null },
      );

      return result.records.map((record) => mapCompanyNode(record.get("company") as Record<string, unknown>));
    } finally {
      await session.close();
    }
  }

  async listCompanies(query: CompanyListQuery) {
    const companies = await this.queryPublishedCompanies(query.q ?? null, query.isMag7 ?? null);

    return companies
      .sort(
        (left, right) =>
          Number(right.isMag7) - Number(left.isMag7) ||
          (right.lastUpdatedAt ?? "").localeCompare(left.lastUpdatedAt ?? "") ||
          (right.marketCapUsd ?? 0) - (left.marketCapUsd ?? 0) ||
          left.name.localeCompare(right.name),
      )
      .map(toCompanyListItem);
  }

  async searchCompanies(query: SearchCompaniesQuery) {
    const companies = await this.queryPublishedCompanies(query.q, query.isMag7 ?? null);

    return companies
      .filter((company) => Boolean(buildCompanySearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => toCompanySearchResultItem(company, query.q));
  }

  async suggestCompanies(query: SuggestCompaniesQuery) {
    const companies = await this.queryPublishedCompanies(query.q, null);

    return companies
      .filter((company) => Boolean(buildCompanySearchMatch(company, query.q)))
      .sort((left, right) => sortCompaniesForSearch(left, right, query.q))
      .slice(0, query.limit)
      .map((company) => toCompanySuggestItem(company, query.q));
  }

  async getCompany(companyId: string) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company {id: $companyId})
        OPTIONAL MATCH (c)<-[:TARGET_OF|SOURCE_OF]-(rel:SupplyRelation)<-[:CONTAINS]-(snapshot:Snapshot)
        WHERE snapshot.status = 'published'
        WITH c, snapshot
        ORDER BY snapshot.publishedAt DESC, snapshot.id DESC
        WITH c, collect(snapshot) AS snapshots
        WITH c, [snapshot IN snapshots WHERE snapshot IS NOT NULL] AS publishedSnapshots
        RETURN c {
          .*,
          primaryRegion: coalesce(c.primaryRegion, c.country),
          activeSnapshotId: head([snapshot IN publishedSnapshots | snapshot.id]),
          lastUpdatedAt: head([snapshot IN publishedSnapshots | snapshot.publishedAt]),
          aliases: coalesce(c.aliases, []),
          canonicalName: coalesce(c.canonicalName, c.name),
          displayName: coalesce(c.displayName, c.name),
          entityProfileJson: c.entityProfileJson,
          searchAliases: coalesce(c.searchAliases, []),
          summary: coalesce(c.summary, c.description)
        } AS company
        LIMIT 1
        `,
        { companyId },
      );

      const record = result.records[0];
      return record ? mapCompanyNode(record.get("company") as Record<string, unknown>) : null;
    } finally {
      await session.close();
    }
  }

  async getCompanyOverview(companyId: string) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company {id: $companyId})
        OPTIONAL MATCH (c)<-[:TARGET_OF|SOURCE_OF]-(rel:SupplyRelation)
        MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        WHERE snapshot.status = 'published'
        MATCH (source:Company)-[:SOURCE_OF]->(rel)-[:TARGET_OF]->(target:Company)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        WITH c, rel, snapshot, source, target, collect(DISTINCT e) AS evidence
        ORDER BY snapshot.publishedAt DESC, snapshot.id DESC
        WITH c, collect(DISTINCT {
          relationId: rel.id,
          tier: rel.tier,
          confidence: rel.confidence,
          sourceId: source.id,
          targetId: target.id,
          evidenceCount: size(evidence)
        }) AS relationRows,
        collect(snapshot) AS snapshots
        RETURN c.name AS companyName,
               head([snapshot IN snapshots | snapshot.id]) AS activeSnapshotId,
               size(relationRows) AS totalRelations,
               size([row IN relationRows WHERE row.tier = 1]) AS tier1SupplierCount,
               size(
                 reduce(
                   supplierIds = [],
                   supplierId IN [row IN relationRows WHERE row.targetId = $companyId | row.sourceId] |
                     CASE
                       WHEN supplierId IN supplierIds THEN supplierIds
                       ELSE supplierIds + supplierId
                     END
                 )
               ) AS supplierCount,
               size([row IN relationRows WHERE row.confidence <> 'confirmed']) AS highRiskRelationCount,
               reduce(total = 0, row IN relationRows | total + row.evidenceCount) AS evidenceCount,
               head([snapshot IN snapshots | snapshot.publishedAt]) AS lastUpdatedAt
        `,
        { companyId },
      );

      const record = result.records[0];
      if (!record) {
        return null;
      }

      return {
        companyId,
        companyName: String(record.get("companyName")),
        activeSnapshotId:
          typeof record.get("activeSnapshotId") === "string" ? String(record.get("activeSnapshotId")) : null,
        totalRelations: toNumber(record.get("totalRelations")) ?? 0,
        tier1SupplierCount: toNumber(record.get("tier1SupplierCount")) ?? 0,
        supplierCount: toNumber(record.get("supplierCount")) ?? 0,
        highRiskRelationCount: toNumber(record.get("highRiskRelationCount")) ?? 0,
        evidenceCount: toNumber(record.get("evidenceCount")) ?? 0,
        evidenceCoverage:
          (toNumber(record.get("totalRelations")) ?? 0) === 0
            ? 0
            : (toNumber(record.get("evidenceCount")) ?? 0) / (toNumber(record.get("totalRelations")) ?? 1),
        lastUpdatedAt:
          typeof record.get("lastUpdatedAt") === "string" ? String(record.get("lastUpdatedAt")) : null,
        source: this.source,
      };
    } finally {
      await session.close();
    }
  }

  async getSubgraph(query: SubgraphQuery) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (root:Company {id: $companyId})
        OPTIONAL MATCH path = (root)-[:TARGET_OF|SOURCE_OF*1..9]-(rel:SupplyRelation)
        WHERE rel.depthFromMag7 <= $depth
          AND length(path) <= (($depth * 2) - 1)
          AND ($relationshipTypes IS NULL OR rel.relationshipType IN $relationshipTypes)
        WITH root, DISTINCT rel
        WHERE rel IS NOT NULL
        MATCH (source:Company)-[:SOURCE_OF]->(rel)-[:TARGET_OF]->(target:Company)
        MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        WHERE (($snapshot = 'published' AND snapshot.status = 'published') OR snapshot.id = $snapshot)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        RETURN source, rel, target, collect(DISTINCT e) AS evidence, head(collect(DISTINCT snapshot)) AS snapshot
        ORDER BY rel.id ASC
        `,
        {
          companyId: query.companyId,
          depth: neo4j.int(query.depth),
          relationshipTypes: query.relationshipTypes ?? null,
          snapshot: query.snapshot,
        },
      );

      const companyMap = new Map<string, SubgraphDTO["nodes"][number]>();
      const relations = result.records.map((resultRecord) =>
        mapRelationRecord(resultRecord, companyMap, query.includeEvidence),
      );

      if (relations.length === 0) {
        const rootCompany = await this.getCompany(query.companyId);
        return {
          snapshot: createSnapshotFallback(query.snapshot, rootCompany?.activeSnapshotId ?? null),
          nodes: rootCompany ? [mapCompanyToGraphNode(rootCompany)] : [],
          relations: [],
        };
      }

      const snapshotNode = pickLatestSnapshot(
        result.records.map((item) => item.get("snapshot") as { properties?: Record<string, unknown> } | null),
      );

      return {
        snapshot:
          snapshotNode ??
          createSnapshotFallback(query.snapshot, pickLatestRelationSnapshotId(relations)),
        nodes: [...companyMap.values()],
        relations,
      };
    } finally {
      await session.close();
    }
  }

  async getPath(query: GraphPathQuery) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (source:Company)-[:SOURCE_OF]->(rel)-[:TARGET_OF]->(target:Company)
        MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        WHERE rel.depthFromMag7 <= $maxDepth
          AND (($snapshot = 'published' AND snapshot.status = 'published') OR snapshot.id = $snapshot)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        RETURN source, rel, target, collect(DISTINCT e) AS evidence, head(collect(DISTINCT snapshot)) AS snapshot
        ORDER BY rel.id ASC
        `,
        {
          sourceCompanyId: query.sourceCompanyId,
          targetCompanyId: query.targetCompanyId,
          maxDepth: neo4j.int(query.maxDepth),
          snapshot: query.snapshot,
        },
      );

      const companyMap = new Map<string, SubgraphDTO["nodes"][number]>();
      const allRelations = result.records.map((resultRecord) =>
        mapRelationRecord(resultRecord, companyMap, query.includeEvidence),
      );
      const adjacency = new Map<string, Array<{ relation: RelationDTO; nextCompanyId: string }>>();

      for (const relation of allRelations) {
        const forward = adjacency.get(relation.sourceId) ?? [];
        forward.push({ relation, nextCompanyId: relation.targetId });
        adjacency.set(relation.sourceId, forward);

        const backward = adjacency.get(relation.targetId) ?? [];
        backward.push({ relation, nextCompanyId: relation.sourceId });
        adjacency.set(relation.targetId, backward);
      }

      const queue: Array<{ companyId: string; relationIds: string[] }> = [
        { companyId: query.sourceCompanyId, relationIds: [] },
      ];
      const seenCompanies = new Set<string>([query.sourceCompanyId]);
      let pathRelationIds: string[] | null = query.sourceCompanyId === query.targetCompanyId ? [] : null;

      while (queue.length > 0 && pathRelationIds === null) {
        const current = queue.shift();
        if (!current) {
          break;
        }

        for (const edge of adjacency.get(current.companyId) ?? []) {
          if (seenCompanies.has(edge.nextCompanyId)) {
            continue;
          }

          const nextRelationIds = [...current.relationIds, edge.relation.id];
          if (edge.nextCompanyId === query.targetCompanyId) {
            pathRelationIds = nextRelationIds;
            break;
          }

          seenCompanies.add(edge.nextCompanyId);
          queue.push({
            companyId: edge.nextCompanyId,
            relationIds: nextRelationIds,
          });
        }
      }

      const relationOrder = new Map((pathRelationIds ?? []).map((relationId, index) => [relationId, index]));
      const relations = allRelations
        .filter((relation) => relationOrder.has(relation.id))
        .sort((left, right) => (relationOrder.get(left.id) ?? 0) - (relationOrder.get(right.id) ?? 0));

      if (relations.length === 0) {
        const [sourceCompany, targetCompany] = await Promise.all([
          this.getCompany(query.sourceCompanyId),
          this.getCompany(query.targetCompanyId),
        ]);
        const nodes = [sourceCompany, targetCompany]
          .filter((company): company is CompanyDetailDTO => Boolean(company))
          .map(mapCompanyToGraphNode);

        return {
          snapshot: createSnapshotFallback(
            query.snapshot,
            sourceCompany?.activeSnapshotId ?? targetCompany?.activeSnapshotId ?? null,
          ),
          nodes,
          relations: [],
        };
      }

      const snapshotNode = pickLatestSnapshot(
        result.records.map((item) => item.get("snapshot") as { properties?: Record<string, unknown> } | null),
      );

      return {
        snapshot:
          snapshotNode ??
          createSnapshotFallback(query.snapshot, pickLatestRelationSnapshotId(relations)),
        nodes: [...companyMap.values()],
        relations,
      };
    } finally {
      await session.close();
    }
  }

  async getGraphStats(query: GraphStatsQuery) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (source:Company)-[:SOURCE_OF]->(rel:SupplyRelation)-[:TARGET_OF]->(target:Company)
        MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        WHERE (($snapshot = 'published' AND snapshot.status = 'published') OR snapshot.id = $snapshot)
          AND ($companyId IS NULL OR source.id = $companyId OR target.id = $companyId)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        RETURN source, target, rel, collect(DISTINCT e) AS evidence, head(collect(DISTINCT snapshot)) AS snapshot
        ORDER BY rel.id ASC
        `,
        {
          snapshot: query.snapshot,
          companyId: query.companyId ?? null,
        },
      );

      const companyIds = new Set<string>();
      const mag7Ids = new Set<string>();
      const evidenceIds = new Set<string>();
      const relationshipTypeBreakdown: Record<string, number> = {};
      const confidenceBreakdown: Record<string, number> = {};

      for (const record of result.records) {
        const source = mapCompanyNode((record.get("source") as { properties: Record<string, unknown> }).properties);
        const target = mapCompanyNode((record.get("target") as { properties: Record<string, unknown> }).properties);
        const relation = (record.get("rel") as { properties: Record<string, unknown> }).properties;
        const evidence = record.get("evidence") as Array<{ properties?: Record<string, unknown> } | null>;

        for (const company of [source, target]) {
          companyIds.add(company.id);
          if (company.isMag7) {
            mag7Ids.add(company.id);
          }
        }

        const relationshipType = String(relation.relationshipType);
        const confidence = String(relation.confidence);
        relationshipTypeBreakdown[relationshipType] = (relationshipTypeBreakdown[relationshipType] ?? 0) + 1;
        confidenceBreakdown[confidence] = (confidenceBreakdown[confidence] ?? 0) + 1;

        for (const item of evidence) {
          if (item?.properties?.id) {
            evidenceIds.add(String(item.properties.id));
          }
        }
      }

      const snapshotNode = pickLatestSnapshot(
        result.records.map((item) => item.get("snapshot") as { properties?: Record<string, unknown> } | null),
      );

      return {
        snapshot: snapshotNode,
        companyCount: companyIds.size,
        relationCount: result.records.length,
        evidenceCount: evidenceIds.size,
        mag7CompanyCount: mag7Ids.size,
        relationshipTypeBreakdown,
        confidenceBreakdown,
        source: this.source,
      };
    } finally {
      await session.close();
    }
  }

  async getRelationEvidence(relationId: string) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (:SupplyRelation {id: $relationId})-[:SUPPORTED_BY]->(e:Evidence)
        RETURN e
        ORDER BY e.publishedAt DESC, e.id ASC
        `,
        { relationId },
      );

      return result.records.map((record) =>
        mapEvidenceProperties(record.get("e").properties as Record<string, unknown>),
      );
    } finally {
      await session.close();
    }
  }

  async importNormalizedPackage(payload: PreparedNormalizedImport) {
    const session = this.driver.session({ database: this.database });

    try {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `
          UNWIND $snapshots AS snapshot
          MERGE (s:Snapshot {id: snapshot.id})
          SET s += snapshot
          `,
          { snapshots: payload.snapshots },
        );

        await tx.run(
          `
          UNWIND $companies AS company
          MERGE (c:Company {id: company.id})
          SET c += company
          `,
          { companies: payload.companies },
        );

        await tx.run(
          `
          UNWIND $relations AS relation
          MERGE (r:SupplyRelation {id: relation.id})
          SET r += relation
          `,
          { relations: payload.relations },
        );

        await tx.run(
          `
          UNWIND $relationEdges AS edge
          MATCH (source:Company {id: edge.sourceCompanyId})
          MATCH (target:Company {id: edge.targetCompanyId})
          MATCH (snapshot:Snapshot {id: edge.snapshotId})
          MATCH (r:SupplyRelation {id: edge.relationId})
          MERGE (source)-[:SOURCE_OF]->(r)
          MERGE (r)-[:TARGET_OF]->(target)
          MERGE (snapshot)-[:CONTAINS]->(r)
          `,
          { relationEdges: payload.relationEdges },
        );

        await tx.run(
          `
          UNWIND $evidence AS evidence
          MERGE (e:Evidence {id: evidence.id})
          SET e += evidence
          `,
          { evidence: payload.evidence },
        );

        await tx.run(
          `
          UNWIND $evidenceBindings AS binding
          MATCH (r:SupplyRelation {id: binding.relationId})
          MATCH (e:Evidence {id: binding.evidenceId})
          MERGE (r)-[:SUPPORTED_BY]->(e)
          `,
          { evidenceBindings: payload.evidenceBindings },
        );
      });

      return {
        companyCount: payload.companies.length,
        relationCount: payload.relations.length,
        evidenceCount: payload.evidence.length,
        snapshotCount: payload.snapshots.length,
      };
    } finally {
      await session.close();
    }
  }
}

export interface Neo4jClientBundle {
  repository: GraphRepository;
  health: () => Promise<Neo4jHealth>;
  close: () => Promise<void>;
}

interface CreateNeo4jBundleOptions {
  mode?: RuntimeMode;
  uri?: string;
  username?: string;
  password?: string;
  database?: string;
}

function wrapRepositoryWithDependencyGuard(repository: GraphRepository): GraphRepository {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return value;
      }

      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          if (isNeo4jUnavailableError(error)) {
            throw new DependencyUnavailableError(
              "neo4j",
              toDependencyDetail(error, "Neo4j connection failed"),
              "Neo4j is currently unavailable; graph queries are temporarily degraded.",
            );
          }

          throw error;
        }
      };
    },
  });
}

class UnavailableGraphRepository implements GraphRepository {
  source = "neo4j" as const;

  constructor(private readonly detail: string) {}

  private unavailable(): never {
    throw new DependencyUnavailableError(
      "neo4j",
      this.detail,
      "Live graph mode requires a reachable Neo4j dependency.",
    );
  }

  async listCompanies() {
    return this.unavailable();
  }

  async searchCompanies() {
    return this.unavailable();
  }

  async suggestCompanies() {
    return this.unavailable();
  }

  async getCompany() {
    return this.unavailable();
  }

  async getCompanyOverview() {
    return this.unavailable();
  }

  async getSubgraph() {
    return this.unavailable();
  }

  async getPath() {
    return this.unavailable();
  }

  async getGraphStats() {
    return this.unavailable();
  }

  async getRelationEvidence() {
    return this.unavailable();
  }

  async importNormalizedPackage() {
    return this.unavailable();
  }
}

export function createNeo4jBundle(options: CreateNeo4jBundleOptions = {}): Neo4jClientBundle {
  const mode = options.mode ?? env.GRAPH_RUNTIME_MODE;
  const uri = options.uri ?? env.NEO4J_URI;
  const username = options.username ?? env.NEO4J_USERNAME;
  const password = options.password ?? env.NEO4J_PASSWORD;
  const database = options.database ?? env.NEO4J_DATABASE;

  if (!uri) {
    if (mode === "prototype") {
      const repository = new MockGraphRepository();
      return {
        repository,
        health: async () => ({
          status: "not_configured",
          detail: "NEO4J_URI is not configured; GRAPH_RUNTIME_MODE=prototype allows mock repository fallback",
          required: false,
        }),
        close: async () => undefined,
      };
    }

    const detail = "NEO4J_URI is not configured; GRAPH_RUNTIME_MODE=live requires a reachable Neo4j instance";
    return {
      repository: new UnavailableGraphRepository(detail),
      health: async () => ({
        status: "not_configured",
        detail,
        required: true,
      }),
      close: async () => undefined,
    };
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  const repository = wrapRepositoryWithDependencyGuard(
    new Neo4jGraphRepository(driver, database),
  );

  return {
    repository,
    health: async () => {
      try {
        await driver.getServerInfo();
        return { status: "up", detail: "Neo4j connection healthy", required: true };
      } catch (error) {
        return {
          status: "down",
          detail: error instanceof Error ? error.message : "Neo4j connection failed",
          required: true,
        };
      }
    },
    close: async () => {
      await driver.close();
    },
  };
}
