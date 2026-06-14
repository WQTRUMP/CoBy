import { readFile } from "node:fs/promises";
import { z } from "zod";

const normalizedRelationSchema = z.object({
  relation_id: z.string(),
  snapshot_id: z.string(),
  company: z.string(),
  company_slug: z.string(),
  supplier: z.string(),
  supplier_slug: z.string(),
  tier: z.number().int().min(1),
  depth_from_mag7: z.number().int().min(0),
  relationship_type: z.string(),
  relationship_subtype: z.string(),
  product_scope: z.array(z.string()).min(1),
  evidence_ids: z.array(z.string()).min(1),
  primary_evidence_id: z.string(),
  evidence_date: z.string(),
  evidence_date_resolution: z.string(),
  evidence_excerpt: z.string(),
  source_url: z.string().url(),
  confidence_label: z.string(),
  confidence_score: z.number().min(0).max(1),
  source_method: z.string(),
  source_count: z.number().int().min(1),
  status: z.string(),
  summary: z.string(),
  notes: z.string().optional(),
  lineage_key: z.string(),
  source_report_path: z.string(),
  last_verified_at: z.string(),
});

const normalizedEvidenceSchema = z.object({
  evidence_id: z.string(),
  relation_id: z.string(),
  source_type: z.string(),
  title: z.string(),
  publisher: z.string(),
  source_url: z.string().url(),
  source_domain: z.string(),
  published_at: z.string(),
  published_at_resolution: z.string(),
  retrieved_at: z.string(),
  excerpt: z.string(),
  citation_text: z.string(),
  page_ref: z.string().optional(),
  language: z.string().default("en"),
  reliability_tier: z.number().int().min(1).max(4),
  parser_version: z.string(),
  license_note: z.string().optional(),
  source_report_path: z.string(),
  notes: z.string().optional(),
});

export type NormalizedRelationRecord = z.infer<typeof normalizedRelationSchema>;
export type NormalizedEvidenceRecord = z.infer<typeof normalizedEvidenceSchema>;

export interface NormalizedImportPackage {
  relations: NormalizedRelationRecord[];
  evidence: NormalizedEvidenceRecord[];
}

interface CompanySeed {
  id: string;
  ticker?: string;
  name: string;
  companyType:
    | "public_company"
    | "supplier"
    | "manufacturer"
    | "logistics"
    | "service_provider"
    | "raw_material";
  country: string;
  isMag7: boolean;
  marketCapUsd: number | null;
  description: string | null;
  aliases: string[];
  importanceScore: number;
}

export interface ImportCompanyNode extends CompanySeed {
  entityType: "Company";
  active: boolean;
}

export interface ImportRelationNode {
  id: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  relationshipType: string;
  relationshipSubtype: string;
  tier: number;
  depthFromMag7: number;
  confidence: string;
  confidenceScore: number;
  summary: string;
  productScope: string | null;
  productScopeList: string[];
  notes: string | null;
  evidenceCount: number;
  snapshotId: string;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  sourceMethod: string;
  sourceCount: number;
  lineageKey: string;
  primaryEvidenceId: string;
  evidenceDate: string;
  evidenceDateResolution: string;
  evidenceExcerpt: string;
  sourceUrl: string;
  sourceReportPath: string;
  lastVerifiedAt: string;
}

export interface ImportEvidenceNode {
  id: string;
  relationId: string;
  sourceType: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  publishedAtResolution: string;
  retrievedAt: string;
  excerpt: string;
  pageRef: string | null;
  language: string;
  hash: string;
  sourceDomain: string;
  citationText: string;
  reliabilityTier: number;
  licenseNote: string | null;
  parserVersion: string;
  sourceReportPath: string;
  notes: string | null;
}

export interface ImportSnapshotNode {
  id: string;
  version: string;
  status: "published";
  publishedAt: string | null;
  scope: string[];
  notes: string | null;
}

export interface PreparedNormalizedImport {
  relations: ImportRelationNode[];
  evidence: ImportEvidenceNode[];
  companies: ImportCompanyNode[];
  snapshots: ImportSnapshotNode[];
}

const companyRegistry = new Map<string, CompanySeed>([
  [
    "apple",
    {
      id: "company:AAPL",
      ticker: "AAPL",
      name: "Apple",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 3100000000000,
      description: "Consumer hardware and services",
      aliases: ["Apple Inc."],
      importanceScore: 1,
    },
  ],
  [
    "microsoft",
    {
      id: "company:MSFT",
      ticker: "MSFT",
      name: "Microsoft",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 3200000000000,
      description: "Cloud platform and enterprise software",
      aliases: ["Microsoft Corporation"],
      importanceScore: 1,
    },
  ],
  [
    "alphabet",
    {
      id: "company:GOOGL",
      ticker: "GOOGL",
      name: "Alphabet",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 2200000000000,
      description: "Search, cloud, ads, devices, and AI infrastructure",
      aliases: ["Alphabet Inc.", "Google"],
      importanceScore: 1,
    },
  ],
  [
    "meta",
    {
      id: "company:META",
      ticker: "META",
      name: "Meta",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 1400000000000,
      description: "Social platforms, devices, and AI infrastructure",
      aliases: ["Meta Platforms, Inc."],
      importanceScore: 1,
    },
  ],
  [
    "tsmc",
    {
      id: "company:TSMC",
      ticker: "TSM",
      name: "TSMC",
      companyType: "manufacturer",
      country: "TW",
      isMag7: false,
      marketCapUsd: 910000000000,
      description: "Semiconductor foundry",
      aliases: ["Taiwan Semiconductor Manufacturing Company"],
      importanceScore: 0.86,
    },
  ],
  [
    "mp-materials",
    {
      id: "company:mp-materials",
      ticker: "MP",
      name: "MP Materials",
      companyType: "raw_material",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "Rare earth materials producer",
      aliases: [],
      importanceScore: 0.62,
    },
  ],
  [
    "openai",
    {
      id: "company:openai",
      name: "OpenAI",
      companyType: "service_provider",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "AI model developer and platform provider",
      aliases: [],
      importanceScore: 0.78,
    },
  ],
  [
    "g42",
    {
      id: "company:g42",
      name: "G42",
      companyType: "service_provider",
      country: "AE",
      isMag7: false,
      marketCapUsd: null,
      description: "Digital infrastructure and AI services company",
      aliases: [],
      importanceScore: 0.58,
    },
  ],
  [
    "broadcom",
    {
      id: "company:AVGO",
      ticker: "AVGO",
      name: "Broadcom",
      companyType: "supplier",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "Semiconductor and infrastructure supplier",
      aliases: ["Broadcom Inc."],
      importanceScore: 0.76,
    },
  ],
  [
    "dhl-express",
    {
      id: "company:dhl-express",
      name: "DHL Express",
      companyType: "logistics",
      country: "DE",
      isMag7: false,
      marketCapUsd: null,
      description: "International logistics provider",
      aliases: ["DHL"],
      importanceScore: 0.54,
    },
  ],
  [
    "nvidia",
    {
      id: "company:NVDA",
      ticker: "NVDA",
      name: "NVIDIA",
      companyType: "supplier",
      country: "US",
      isMag7: true,
      marketCapUsd: 3300000000000,
      description: "Accelerated computing and AI infrastructure company",
      aliases: ["NVIDIA Corporation"],
      importanceScore: 1,
    },
  ],
  [
    "goertek",
    {
      id: "company:goertek",
      name: "Goertek",
      companyType: "manufacturer",
      country: "CN",
      isMag7: false,
      marketCapUsd: null,
      description: "Electronics manufacturing and components supplier",
      aliases: ["Goertek Inc."],
      importanceScore: 0.56,
    },
  ],
]);

function deriveFallbackCompany(slug: string, name: string, isMag7 = false): CompanySeed {
  return {
    id: isMag7 ? `company:${slug.toUpperCase()}` : `company:${slug}`,
    ticker: isMag7 ? slug.toUpperCase() : undefined,
    name,
    companyType: isMag7 ? "public_company" : "supplier",
    country: "unknown",
    isMag7,
    marketCapUsd: null,
    description: null,
    aliases: [],
    importanceScore: isMag7 ? 1 : 0.5,
  };
}

function getCompanySeed(slug: string, name: string, isMag7: boolean) {
  return companyRegistry.get(slug) ?? deriveFallbackCompany(slug, name, isMag7);
}

export async function readNormalizedJsonlFile<T>(
  filePath: string,
  schema: z.ZodSchema<T>,
): Promise<T[]> {
  const contents = await readFile(filePath, "utf8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parsed = JSON.parse(line) as unknown;
      return schema.parse(parsed, {
        path: [filePath, index + 1],
      });
    });
}

export async function loadNormalizedImportPackage(
  relationFile: string,
  evidenceFile: string,
): Promise<NormalizedImportPackage> {
  const [relations, evidence] = await Promise.all([
    readNormalizedJsonlFile(relationFile, normalizedRelationSchema),
    readNormalizedJsonlFile(evidenceFile, normalizedEvidenceSchema),
  ]);

  return {
    relations,
    evidence,
  };
}

export function prepareNormalizedImport(pkg: NormalizedImportPackage): PreparedNormalizedImport {
  const companyMap = new Map<string, ImportCompanyNode>();
  const snapshotMap = new Map<string, ImportSnapshotNode>();

  for (const relation of pkg.relations) {
    const companySeed = getCompanySeed(relation.company_slug, relation.company, true);
    const supplierSeed = getCompanySeed(relation.supplier_slug, relation.supplier, false);

    companyMap.set(companySeed.id, {
      ...companySeed,
      entityType: "Company",
      active: true,
    });
    companyMap.set(supplierSeed.id, {
      ...supplierSeed,
      entityType: "Company",
      active: true,
    });

    const existingSnapshot = snapshotMap.get(relation.snapshot_id);
    const scope = new Set(existingSnapshot?.scope ?? []);
    scope.add(companySeed.id);
    snapshotMap.set(relation.snapshot_id, {
      id: relation.snapshot_id,
      version: relation.snapshot_id.replace("snapshot:", "").replace(/-/g, "."),
      status: "published",
      publishedAt: `${relation.last_verified_at.replace("Z", ".000Z")}`,
      scope: [...scope],
      notes: "Imported from normalized Mag7 sample package",
    });
  }

  return {
    companies: [...companyMap.values()],
    snapshots: [...snapshotMap.values()],
    relations: pkg.relations.map((relation) => ({
      id: relation.relation_id,
      sourceCompanyId: getCompanySeed(relation.supplier_slug, relation.supplier, false).id,
      targetCompanyId: getCompanySeed(relation.company_slug, relation.company, true).id,
      relationshipType: relation.relationship_type,
      relationshipSubtype: relation.relationship_subtype,
      tier: relation.tier,
      depthFromMag7: relation.depth_from_mag7,
      confidence: relation.confidence_label,
      confidenceScore: relation.confidence_score,
      summary: relation.summary,
      productScope: relation.product_scope.join(", "),
      productScopeList: relation.product_scope,
      notes: relation.notes ?? null,
      evidenceCount: relation.evidence_ids.length,
      snapshotId: relation.snapshot_id,
      status: relation.status,
      validFrom: relation.evidence_date,
      validTo: null,
      sourceMethod: relation.source_method,
      sourceCount: relation.source_count,
      lineageKey: relation.lineage_key,
      primaryEvidenceId: relation.primary_evidence_id,
      evidenceDate: relation.evidence_date,
      evidenceDateResolution: relation.evidence_date_resolution,
      evidenceExcerpt: relation.evidence_excerpt,
      sourceUrl: relation.source_url,
      sourceReportPath: relation.source_report_path,
      lastVerifiedAt: relation.last_verified_at,
    })),
    evidence: pkg.evidence.map((evidence) => ({
      id: evidence.evidence_id,
      relationId: evidence.relation_id,
      sourceType: evidence.source_type,
      title: evidence.title,
      publisher: evidence.publisher,
      url: evidence.source_url,
      publishedAt: evidence.published_at,
      publishedAtResolution: evidence.published_at_resolution,
      retrievedAt: evidence.retrieved_at,
      excerpt: evidence.excerpt,
      pageRef: evidence.page_ref ?? null,
      language: evidence.language,
      hash: evidence.evidence_id,
      sourceDomain: evidence.source_domain,
      citationText: evidence.citation_text,
      reliabilityTier: evidence.reliability_tier,
      licenseNote: evidence.license_note ?? null,
      parserVersion: evidence.parser_version,
      sourceReportPath: evidence.source_report_path,
      notes: evidence.notes ?? null,
    })),
  };
}

