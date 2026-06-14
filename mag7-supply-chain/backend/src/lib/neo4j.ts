import neo4j, { type Driver } from "neo4j-driver";

import { env } from "../config/env.js";
import type {
  CompanyDTO,
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
  listCompanies(query?: string): Promise<CompanyDTO[]>;
  getCompany(companyId: string): Promise<CompanyDTO | null>;
  getCompanyOverview(companyId: string): Promise<Record<string, unknown> | null>;
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

function mapCompanyNode(properties: Record<string, unknown>): CompanyDTO {
  return {
    id: String(properties.id),
    ticker: typeof properties.ticker === "string" ? properties.ticker : undefined,
    name: String(properties.name),
    entityType: "Company",
    companyType: String(properties.companyType) as CompanyDTO["companyType"],
    country: String(properties.country),
    isMag7: Boolean(properties.isMag7),
    marketCapUsd: toNumber(properties.marketCapUsd),
    description: typeof properties.description === "string" ? properties.description : null,
    aliases: toStringArray(properties.aliases),
    active: properties.active !== false,
    importanceScore: toNumber(properties.importanceScore) ?? 0.5,
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

  async listCompanies(query?: string) {
    if (!query) {
      return mockCompanies;
    }

    const normalized = query.toLowerCase();
    return mockCompanies.filter(
      (company) =>
        company.name.toLowerCase().includes(normalized) ||
        company.ticker?.toLowerCase().includes(normalized),
    );
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
      totalRelations: relatedRelations.length,
      supplierCount: new Set(relatedRelations.map((relation) => relation.sourceId)).size,
      evidenceCount: relatedRelations.reduce(
        (sum, relation) => sum + (relation.evidenceCount ?? relation.evidence?.length ?? 0),
        0,
      ),
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

class Neo4jGraphRepository implements GraphRepository {
  source = "neo4j" as const;

  constructor(private readonly driver: Driver, private readonly database: string) {}

  async listCompanies(query?: string) {
    const session = this.driver.session({ database: this.database });

    try {
      const result = await session.run(
        `
        MATCH (c:Company)
        WHERE $query IS NULL
          OR toLower(c.name) CONTAINS toLower($query)
          OR toLower(c.ticker) CONTAINS toLower($query)
        RETURN c
        ORDER BY c.isMag7 DESC, c.marketCapUsd DESC
        LIMIT 25
        `,
        { query: query ?? null },
      );

      return result.records.map((record) =>
        mapCompanyNode(record.get("c").properties as Record<string, unknown>),
      );
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
        RETURN c
        LIMIT 1
        `,
        { companyId },
      );

      const record = result.records[0];
      return record ? mapCompanyNode(record.get("c").properties as Record<string, unknown>) : null;
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
        OPTIONAL MATCH (rel:SupplyRelation)
        WHERE rel.sourceCompanyId = c.id OR rel.targetCompanyId = c.id
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        RETURN c.name AS companyName,
               count(DISTINCT rel) AS totalRelations,
               count(DISTINCT CASE WHEN rel.targetCompanyId = c.id THEN rel.sourceCompanyId END) AS supplierCount,
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
        totalRelations: toNumber(record.get("totalRelations")) ?? 0,
        supplierCount: toNumber(record.get("supplierCount")) ?? 0,
        evidenceCount: toNumber(record.get("evidenceCount")) ?? 0,
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
        OPTIONAL MATCH (rel:SupplyRelation)
        WHERE rel.depthFromMag7 <= $depth
          AND ($relationshipTypes IS NULL OR rel.relationshipType IN $relationshipTypes)
          AND (rel.sourceCompanyId = root.id OR rel.targetCompanyId = root.id)
        OPTIONAL MATCH (source:Company {id: rel.sourceCompanyId})
        OPTIONAL MATCH (target:Company {id: rel.targetCompanyId})
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        OPTIONAL MATCH (snapshot:Snapshot {id: rel.snapshotId})
        RETURN collect(DISTINCT source) + collect(DISTINCT target) + collect(DISTINCT root) AS companies,
               collect(DISTINCT rel) AS relations,
               collect(DISTINCT {relationId: rel.id, evidence: e}) AS evidenceLinks,
               head(collect(DISTINCT snapshot)) AS snapshot
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
      for (const companyNode of record.get("companies") as Array<{ properties: Record<string, unknown> } | null>) {
        if (!companyNode?.properties?.id) {
          continue;
        }

        const mapped = mapCompanyNode(companyNode.properties);
        companyMap.set(mapped.id, {
          id: mapped.id,
          entityType: "Company",
          label: mapped.name,
          company: mapped,
          country: mapped.country,
          marketCapUsd: mapped.marketCapUsd,
          importanceScore: mapped.importanceScore,
        });
      }

      const evidenceByRelation = new Map<string, EvidenceDTO[]>();
      for (const item of record.get("evidenceLinks") as Array<
        { relationId?: string | null; evidence?: { properties?: Record<string, unknown> } | null } | null
      >) {
        if (!item?.relationId || !item.evidence?.properties) {
          continue;
        }

        evidenceByRelation.set(String(item.relationId), [
          ...(evidenceByRelation.get(String(item.relationId)) ?? []),
          mapEvidenceProperties(item.evidence.properties),
        ]);
      }

      const relations = (record.get("relations") as Array<{ properties: Record<string, unknown> } | null>)
        .filter(Boolean)
        .map((relationNode) => {
          const relation = relationNode!.properties;
          const items = evidenceByRelation.get(String(relation.id)) ?? [];

          return {
            id: String(relation.id),
            sourceId: String(relation.sourceCompanyId),
            targetId: String(relation.targetCompanyId),
            relationshipType: String(relation.relationshipType) as SubgraphDTO["relations"][number]["relationshipType"],
            tier: toNumber(relation.tier) ?? 1,
            depthFromMag7: toNumber(relation.depthFromMag7) ?? 1,
            confidence: String(relation.confidence) as SubgraphDTO["relations"][number]["confidence"],
            confidenceScore: toNumber(relation.confidenceScore) ?? 0,
            summary: String(relation.summary),
            productScope: typeof relation.productScope === "string" ? relation.productScope : null,
            notes: typeof relation.notes === "string" ? relation.notes : null,
            evidenceCount: toNumber(relation.evidenceCount) ?? items.length,
            snapshotId: String(relation.snapshotId),
            status: String(relation.status) as SubgraphDTO["relations"][number]["status"],
            validFrom: typeof relation.validFrom === "string" ? relation.validFrom : null,
            validTo: typeof relation.validTo === "string" ? relation.validTo : null,
            evidence: query.includeEvidence ? items : undefined,
          };
        });

      if (relations.length === 0) {
        return mockSubgraph;
      }

      const snapshotNode = record.get("snapshot") as { properties?: Record<string, unknown> } | null;

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
