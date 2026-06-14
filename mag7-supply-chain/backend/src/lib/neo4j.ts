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

export type DependencyStatus = "up" | "down" | "not_configured";

export interface Neo4jHealth {
  status: DependencyStatus;
  detail: string;
}

export interface GraphRepository {
  source: "neo4j" | "mock";
  listCompanies(query?: string): Promise<CompanyDTO[]>;
  getSubgraph(query: SubgraphQuery): Promise<SubgraphDTO>;
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

  async getSubgraph(query: SubgraphQuery) {
    const filtered = {
      ...mockSubgraph,
      relations: mockSubgraph.relations.filter((relation: RelationDTO) => {
        const matchesCompany =
          relation.sourceId === query.companyId || relation.targetId === query.companyId;
        const matchesDepth = relation.depthFromMag7 <= query.depth;
        const matchesType =
          !query.relationshipTypes || query.relationshipTypes.includes(relation.relationshipType);

        return matchesCompany || (matchesDepth && matchesType);
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

      return result.records.map((record) => {
        const node = record.get("c").properties as Record<string, unknown>;
        return {
          id: String(node.id),
          ticker: typeof node.ticker === "string" ? node.ticker : undefined,
          name: String(node.name),
          entityType: "Company" as const,
          companyType: String(node.companyType) as
            | "public_company"
            | "supplier"
            | "manufacturer"
            | "logistics"
            | "service_provider"
            | "raw_material",
          country: String(node.country),
          isMag7: Boolean(node.isMag7),
          marketCapUsd: typeof node.marketCapUsd === "number" ? node.marketCapUsd : null,
          description: typeof node.description === "string" ? node.description : null,
          aliases: Array.isArray(node.aliases) ? (node.aliases as string[]) : [],
          active: node.active !== false,
          importanceScore: typeof node.importanceScore === "number" ? node.importanceScore : 0.5,
        };
      });
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
        MATCH path = (root)<-[:TARGET_OF*1..2]-(rel:SupplyRelation)-[:SOURCE_OF*1..2]->(neighbor:Company)
        WHERE rel.depthFromMag7 <= $depth
          AND ($relationshipTypes IS NULL OR rel.relationshipType IN $relationshipTypes)
        OPTIONAL MATCH (rel)-[:SUPPORTED_BY]->(e:Evidence)
        OPTIONAL MATCH (snapshot:Snapshot {id: rel.snapshotId})
        RETURN collect(DISTINCT root) + collect(DISTINCT neighbor) AS companies,
               collect(DISTINCT rel) AS relations,
               collect(DISTINCT e) AS evidence,
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

      const companies = (record.get("companies") as Array<{ properties: Record<string, unknown> }>)
        .filter(Boolean)
        .map((companyNode) => ({
          id: String(companyNode.properties.id),
          entityType: "Company" as const,
          label: String(companyNode.properties.name),
          country: String(companyNode.properties.country ?? ""),
          marketCapUsd:
            typeof companyNode.properties.marketCapUsd === "number"
              ? companyNode.properties.marketCapUsd
              : null,
          importanceScore:
            typeof companyNode.properties.importanceScore === "number"
              ? companyNode.properties.importanceScore
              : 0.5,
        }));

      const evidenceByRelation = new Map<string, Array<Record<string, unknown>>>();
      for (const item of record.get("evidence") as Array<{ properties: Record<string, unknown> }>) {
        if (!item) {
          continue;
        }

        const relationId = String(item.properties.relationId ?? "");
        if (!relationId) {
          continue;
        }

        evidenceByRelation.set(relationId, [...(evidenceByRelation.get(relationId) ?? []), item.properties]);
      }

      const relations = (record.get("relations") as Array<{ properties: Record<string, unknown> }>).map(
        (relationNode) => {
          const relation = relationNode.properties;
          const items = evidenceByRelation.get(String(relation.id)) ?? [];

          return {
            id: String(relation.id),
            sourceId: String(relation.sourceCompanyId),
            targetId: String(relation.targetCompanyId),
            relationshipType: String(relation.relationshipType) as SubgraphDTO["relations"][number]["relationshipType"],
            tier: Number(relation.tier),
            depthFromMag7: Number(relation.depthFromMag7),
            confidence: String(relation.confidence) as SubgraphDTO["relations"][number]["confidence"],
            confidenceScore: Number(relation.confidenceScore),
            summary: String(relation.summary),
            evidenceCount: Number(relation.evidenceCount ?? items.length),
            snapshotId: String(relation.snapshotId),
            status: String(relation.status) as SubgraphDTO["relations"][number]["status"],
            validFrom: typeof relation.validFrom === "string" ? relation.validFrom : null,
            validTo: typeof relation.validTo === "string" ? relation.validTo : null,
            evidence: query.includeEvidence
              ? items.map((evidence): EvidenceDTO => ({
                  id: String(evidence.id),
                  sourceType: String(evidence.sourceType) as EvidenceDTO["sourceType"],
                  title: String(evidence.title),
                  publisher: String(evidence.publisher),
                  url: String(evidence.url),
                  publishedAt: String(evidence.publishedAt),
                  retrievedAt: String(evidence.retrievedAt),
                  excerpt: String(evidence.excerpt),
                  pageRef: typeof evidence.pageRef === "string" ? evidence.pageRef : null,
                  language: String(evidence.language ?? "en"),
                  hash: String(evidence.hash),
                }))
              : undefined,
          };
        },
      );

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
              scope: Array.isArray(snapshotNode.properties.scope)
                ? (snapshotNode.properties.scope as string[])
                : [],
              notes: typeof snapshotNode.properties.notes === "string" ? snapshotNode.properties.notes : null,
            }
          : mockSubgraph.snapshot,
        nodes: companies,
        relations,
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
