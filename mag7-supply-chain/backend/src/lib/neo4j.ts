import neo4j, { type Driver } from "neo4j-driver";

import { env } from "../config/env.js";
import type {
  CompanyDetailDTO,
  CompanyListItemDTO,
  CompanyListQuery,
  CompanyOverviewDTO,
  EvidenceDTO,
  RelationDTO,
  SubgraphDTO,
  SubgraphQuery,
} from "../../../packages/contracts/src/index.js";
import { mockCompanies, mockSubgraph } from "./mock-data.js";
import type { PreparedNormalizedImport } from "./normalized-package.js";

export type DependencyStatus = "up" | "down" | "not_configured";

export interface Neo4jHealth {
  status: DependencyStatus;
  detail: string;
}

export interface GraphRepository {
  source: "neo4j" | "mock";
  listCompanies(query: CompanyListQuery): Promise<CompanyListItemDTO[]>;
  getCompany(companyId: string): Promise<CompanyDetailDTO | null>;
  getCompanyOverview(companyId: string): Promise<CompanyOverviewDTO | null>;
  getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO>;
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

function mapCompanyNode(properties: Record<string, unknown>): CompanyDetailDTO {
  return {
    id: String(properties.id),
    ticker: typeof properties.ticker === "string" ? properties.ticker : undefined,
    name: String(properties.name),
    entityType: "Company",
    companyType: String(properties.companyType) as CompanyDetailDTO["companyType"],
    country: String(properties.country),
    isMag7: Boolean(properties.isMag7),
    marketCapUsd: toNumber(properties.marketCapUsd),
    description: typeof properties.description === "string" ? properties.description : null,
    aliases: toStringArray(properties.aliases),
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
    isMag7: company.isMag7,
    marketCapUsd: company.marketCapUsd,
    primaryRegion: company.primaryRegion,
    activeSnapshotId: company.activeSnapshotId,
  };
}

function mapEvidenceProperties(properties: Record<string, unknown>): EvidenceDTO {
  return {
    id: String(properties.id),
    sourceType: String(properties.sourceType) as EvidenceDTO["sourceType"],
    title: String(properties.title),
    publisher: String(properties.publisher),
    url: String(properties.url),
    publishedAt: String(properties.publishedAt),
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
          company.ticker?.toLowerCase().includes(normalized)
        );
      })
      .map(toCompanyListItem);
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

  async listCompanies(query: CompanyListQuery) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company)
        WHERE ($query IS NULL
          OR toLower(c.name) CONTAINS toLower($query)
          OR toLower(coalesce(c.ticker, "")) CONTAINS toLower($query))
          AND ($isMag7 IS NULL OR c.isMag7 = $isMag7)
        OPTIONAL MATCH (c)<-[:TARGET_OF]-(targetRel:SupplyRelation)<-[:CONTAINS]-(targetSnapshot:Snapshot)
        OPTIONAL MATCH (c)-[:SOURCE_OF]->(sourceRel:SupplyRelation)<-[:CONTAINS]-(sourceSnapshot:Snapshot)
        RETURN c {
          .*,
          primaryRegion: coalesce(c.primaryRegion, c.country),
          activeSnapshotId: coalesce(head(collect(DISTINCT targetSnapshot.id)), head(collect(DISTINCT sourceSnapshot.id))),
          lastUpdatedAt: coalesce(max(targetSnapshot.publishedAt), max(sourceSnapshot.publishedAt))
        } AS company
        ORDER BY c.isMag7 DESC, c.marketCapUsd DESC, c.name ASC
        `,
        { query: query.q ?? null, isMag7: query.isMag7 ?? null },
      );

      return result.records
        .map((record) => mapCompanyNode(record.get("company") as Record<string, unknown>))
        .map(toCompanyListItem);
    } finally {
      await session.close();
    }
  }

  async getCompany(companyId: string) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company {id: $companyId})
        OPTIONAL MATCH (c)<-[:TARGET_OF]-(targetRel:SupplyRelation)<-[:CONTAINS]-(targetSnapshot:Snapshot)
        OPTIONAL MATCH (c)-[:SOURCE_OF]->(sourceRel:SupplyRelation)<-[:CONTAINS]-(sourceSnapshot:Snapshot)
        RETURN c {
          .*,
          primaryRegion: coalesce(c.primaryRegion, c.country),
          activeSnapshotId: coalesce(head(collect(DISTINCT targetSnapshot.id)), head(collect(DISTINCT sourceSnapshot.id))),
          lastUpdatedAt: coalesce(max(targetSnapshot.publishedAt), max(sourceSnapshot.publishedAt)),
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
        OPTIONAL MATCH (supplier:Company)-[:SOURCE_OF]->(rel:SupplyRelation)-[:TARGET_OF]->(c)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        OPTIONAL MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        RETURN c.name AS companyName,
               head(collect(DISTINCT snapshot.id)) AS activeSnapshotId,
               count(DISTINCT rel) AS totalRelations,
               count(DISTINCT CASE WHEN rel.tier = 1 THEN supplier END) AS tier1SupplierCount,
               count(DISTINCT supplier) AS supplierCount,
               count(DISTINCT CASE WHEN rel.confidence <> 'confirmed' THEN rel END) AS highRiskRelationCount,
               count(DISTINCT e) AS evidenceCount,
               max(rel.lastVerifiedAt) AS lastUpdatedAt
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
        WITH DISTINCT rel
        WHERE rel IS NOT NULL
        MATCH (source:Company)-[:SOURCE_OF]->(rel)-[:TARGET_OF]->(target:Company)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        OPTIONAL MATCH (snapshot:Snapshot)-[:CONTAINS]->(rel)
        RETURN source, rel, target, collect(DISTINCT e) AS evidence, head(collect(DISTINCT snapshot)) AS snapshot
        ORDER BY rel.id ASC
        `,
        {
          companyId: query.companyId,
          depth: neo4j.int(query.depth),
          relationshipTypes: query.relationshipTypes ?? null,
        },
      );

      const record = result.records[0];
      if (!record) {
        return mockSubgraph;
      }

      const companyMap = new Map<string, SubgraphDTO["nodes"][number]>();
      const relations = result.records.map((resultRecord) => {
          const sourceNode = resultRecord.get("source") as { properties: Record<string, unknown> };
          const targetNode = resultRecord.get("target") as { properties: Record<string, unknown> };
          const relationNode = resultRecord.get("rel") as { properties: Record<string, unknown> };
          const sourceCompany = mapCompanyNode(sourceNode.properties);
          const targetCompany = mapCompanyNode(targetNode.properties);
          const relation = relationNode.properties;

          for (const company of [sourceCompany, targetCompany]) {
            companyMap.set(company.id, {
              id: company.id,
              entityType: "Company",
              label: company.name,
              company,
              country: company.country,
              marketCapUsd: company.marketCapUsd,
              importanceScore: company.importanceScore,
            });
          }

          const items = (resultRecord.get("evidence") as Array<{ properties?: Record<string, unknown> } | null>)
            .filter((item): item is { properties: Record<string, unknown> } => Boolean(item?.properties))
            .map((item) => mapEvidenceProperties(item.properties));

          return {
            id: String(relation.id),
            sourceId: sourceCompany.id,
            targetId: targetCompany.id,
            relationshipType: String(relation.relationshipType) as SubgraphDTO["relations"][number]["relationshipType"],
            tier: toNumber(relation.tier) ?? 1,
            depthFromMag7: toNumber(relation.depthFromMag7) ?? 1,
            confidence: String(relation.confidence) as SubgraphDTO["relations"][number]["confidence"],
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
            primaryEvidenceId:
              typeof relation.primaryEvidenceId === "string" ? relation.primaryEvidenceId : null,
            evidenceCount: toNumber(relation.evidenceCount) ?? items.length,
            snapshotId: String(relation.snapshotId),
            status: String(relation.status) as SubgraphDTO["relations"][number]["status"],
            sourceMethod: typeof relation.sourceMethod === "string" ? relation.sourceMethod : null,
            sourceCount: toNumber(relation.sourceCount) ?? 0,
            lineageKey: typeof relation.lineageKey === "string" ? relation.lineageKey : null,
            lastVerifiedAt:
              typeof relation.lastVerifiedAt === "string" ? relation.lastVerifiedAt : null,
            validFrom: typeof relation.validFrom === "string" ? relation.validFrom : null,
            validTo: typeof relation.validTo === "string" ? relation.validTo : null,
            evidence: query.includeEvidence ? items : undefined,
          };
        });

      if (relations.length === 0) {
        return mockSubgraph;
      }

      const snapshotNode = result.records.find((item) => item.get("snapshot"))?.get("snapshot") as
        | { properties?: Record<string, unknown> }
        | null;

      return {
        snapshot: snapshotNode?.properties
          ? {
              id: String(snapshotNode.properties.id),
              version: String(snapshotNode.properties.version),
              status: String(snapshotNode.properties.status) as SubgraphDTO["snapshot"]["status"],
              publishedAt:
                typeof snapshotNode.properties.publishedAt === "string"
                  ? snapshotNode.properties.publishedAt
                  : null,
              scope: toStringArray(snapshotNode.properties.scope),
              notes: typeof snapshotNode.properties.notes === "string" ? snapshotNode.properties.notes : null,
            }
          : mockSubgraph.snapshot,
        nodes: [...companyMap.values()],
        relations,
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
          WITH r, relation
          MATCH (source:Company {id: relation.sourceCompanyId})
          MATCH (target:Company {id: relation.targetCompanyId})
          MATCH (snapshot:Snapshot {id: relation.snapshotId})
          MERGE (source)-[:SOURCE_OF]->(r)
          MERGE (r)-[:TARGET_OF]->(target)
          MERGE (snapshot)-[:CONTAINS]->(r)
          `,
          { relations: payload.relations },
        );

        await tx.run(
          `
          UNWIND $evidence AS evidence
          MERGE (e:Evidence {id: evidence.id})
          SET e += evidence
          WITH e, evidence
          MATCH (r:SupplyRelation {id: evidence.relationId})
          MERGE (r)-[:SUPPORTED_BY]->(e)
          `,
          { evidence: payload.evidence },
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

export function createNeo4jBundle(): Neo4jClientBundle {
  if (!env.NEO4J_URI) {
    const repository = new MockGraphRepository();
    return {
      repository,
      health: async () => ({
        status: "not_configured",
        detail: "NEO4J_URI is not configured; using mock repository",
      }),
      close: async () => undefined,
    };
  }

  const driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD));
  const repository = new Neo4jGraphRepository(driver, env.NEO4J_DATABASE);

  return {
    repository,
    health: async () => {
      try {
        await driver.getServerInfo();
        return { status: "up", detail: "Neo4j connection healthy" };
      } catch (error) {
        return {
          status: "down",
          detail: error instanceof Error ? error.message : "Neo4j connection failed",
        };
      }
    },
    close: async () => {
      await driver.close();
    },
  };
}
