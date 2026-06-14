import { readFile } from "node:fs/promises";
import { z } from "zod";

import {
  standardizedImportEvidenceRecordSchema,
  standardizedImportPackageSchema,
  standardizedImportRelationRecordSchema,
  type DateResolution,
  type EntityAliasRecord,
  type EntityProfile,
  type StandardizedImportEvidenceRecord,
  type ImportEntityRef,
  type StandardizedImportRelationRecord,
} from "@mag7/contracts";
export type NormalizedRelationRecord = StandardizedImportRelationRecord;
export type NormalizedEvidenceRecord = StandardizedImportEvidenceRecord;
export type NormalizedRelationInput = z.input<typeof standardizedImportRelationRecordSchema>;
export type NormalizedEvidenceInput = z.input<typeof standardizedImportEvidenceRecordSchema>;
export type NormalizedImportPackage = z.input<typeof standardizedImportPackageSchema>;

interface CompanySeed {
  id: string;
  ticker?: string;
  name: string;
  canonicalName: string;
  displayName: string;
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
  entityProfile: EntityProfile;
  importanceScore: number;
}

export interface ImportCompanyNode extends CompanySeed {
  entityType: "Company";
  active: boolean;
  searchAliases: string[];
  entityProfileJson: string;
}

export interface ImportRelationNode {
  id: string;
  relationshipType: StandardizedImportRelationRecord["relationship_type"];
  relationshipSubtype: string;
  tier: number;
  depthFromMag7: number;
  confidence: StandardizedImportRelationRecord["confidence_label"];
  confidenceScore: number;
  summary: string;
  productScope: string[];
  notes: string | null;
  evidenceIds: string[];
  evidenceCount: number;
  snapshotId: string;
  status: string;
  evidenceDate: string | null;
  evidenceDateResolution: DateResolution | null;
  evidenceDateNormalized: string | null;
  evidenceDateIsNormalized: boolean;
  validFrom: string | null;
  validFromResolution: DateResolution | null;
  validTo: string | null;
  validToResolution: DateResolution | null;
  validityNote: string | null;
  sourceMethod: string;
  sourceCount: number;
  lineageKey: string;
  primaryEvidenceId: string;
  evidenceExcerpt: string;
  sourceUrl: string;
  sourceReportPath: string;
  lastVerifiedAt: string;
}

export interface ImportRelationEdge {
  relationId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  snapshotId: string;
}

export interface ImportEvidenceNode {
  id: string;
  sourceType: StandardizedImportEvidenceRecord["source_type"];
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  publishedAtResolution: DateResolution;
  coverageStart: string | null;
  coverageEnd: string | null;
  coverageStartResolution: DateResolution | null;
  coverageEndResolution: DateResolution | null;
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

export interface ImportEvidenceBinding {
  relationId: string;
  evidenceId: string;
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
  relationEdges: ImportRelationEdge[];
  evidence: ImportEvidenceNode[];
  evidenceBindings: ImportEvidenceBinding[];
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
      canonicalName: "Apple",
      displayName: "Apple",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 3100000000000,
      description: "Consumer hardware and services",
      aliases: ["Apple Inc."],
      entityProfile: {
        canonicalName: "Apple",
        displayName: "Apple",
        legalEntities: [
          createAliasRecord("company:AAPL", "Apple Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [],
        aliases: [createAliasRecord("company:AAPL", "Apple", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 1,
    },
  ],
  [
    "microsoft",
    {
      id: "company:MSFT",
      ticker: "MSFT",
      name: "Microsoft",
      canonicalName: "Microsoft",
      displayName: "Microsoft",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 3200000000000,
      description: "Cloud platform and enterprise software",
      aliases: ["Microsoft Corporation"],
      entityProfile: {
        canonicalName: "Microsoft",
        displayName: "Microsoft",
        legalEntities: [
          createAliasRecord("company:MSFT", "Microsoft Corporation", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [
          createAliasRecord("company:MSFT", "Azure", "brand", { source: "registry" }),
          createAliasRecord("company:MSFT", "Xbox", "brand", { source: "registry" }),
        ],
        aliases: [
          createAliasRecord("company:MSFT", "Microsoft", "canonical", { isPrimary: true, source: "registry" }),
        ],
      },
      importanceScore: 1,
    },
  ],
  [
    "alphabet",
    {
      id: "company:GOOGL",
      ticker: "GOOGL",
      name: "Alphabet",
      canonicalName: "Alphabet",
      displayName: "Google",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 2200000000000,
      description: "Search, cloud, ads, devices, and AI infrastructure",
      aliases: ["Alphabet Inc.", "Google"],
      entityProfile: {
        canonicalName: "Alphabet",
        displayName: "Google",
        legalEntities: [
          createAliasRecord("company:GOOGL", "Alphabet Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
          createAliasRecord("company:GOOGL", "Google LLC", "legal_entity", {
            source: "registry",
          }),
        ],
        brands: [
          createAliasRecord("company:GOOGL", "Google Cloud", "brand", { source: "registry" }),
        ],
        aliases: [
          createAliasRecord("company:GOOGL", "Alphabet", "canonical", { isPrimary: true, source: "registry" }),
          createAliasRecord("company:GOOGL", "Google", "short_name", { isPrimary: true, source: "registry" }),
        ],
      },
      importanceScore: 1,
    },
  ],
  [
    "meta",
    {
      id: "company:META",
      ticker: "META",
      name: "Meta",
      canonicalName: "Meta",
      displayName: "Meta",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 1400000000000,
      description: "Social platforms, devices, and AI infrastructure",
      aliases: ["Meta Platforms, Inc."],
      entityProfile: {
        canonicalName: "Meta",
        displayName: "Meta",
        legalEntities: [
          createAliasRecord("company:META", "Meta Platforms, Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [
          createAliasRecord("company:META", "Reality Labs", "brand", { source: "registry" }),
        ],
        aliases: [
          createAliasRecord("company:META", "Meta", "canonical", { isPrimary: true, source: "registry" }),
          createAliasRecord("company:META", "Meta IR", "search_hint", { source: "registry" }),
        ],
      },
      importanceScore: 1,
    },
  ],
  [
    "amazon",
    {
      id: "company:AMZN",
      ticker: "AMZN",
      name: "Amazon",
      canonicalName: "Amazon",
      displayName: "Amazon",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 2100000000000,
      description: "E-commerce, cloud, logistics, and devices platform",
      aliases: ["Amazon.com, Inc."],
      entityProfile: {
        canonicalName: "Amazon",
        displayName: "Amazon",
        legalEntities: [
          createAliasRecord("company:AMZN", "Amazon.com, Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [
          createAliasRecord("company:AMZN", "AWS", "brand", { source: "registry" }),
        ],
        aliases: [createAliasRecord("company:AMZN", "Amazon", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 1,
    },
  ],
  [
    "tsmc",
    {
      id: "company:TSMC",
      ticker: "TSM",
      name: "TSMC",
      canonicalName: "TSMC",
      displayName: "TSMC",
      companyType: "manufacturer",
      country: "TW",
      isMag7: false,
      marketCapUsd: 910000000000,
      description: "Semiconductor foundry",
      aliases: ["Taiwan Semiconductor Manufacturing Company"],
      entityProfile: {
        canonicalName: "TSMC",
        displayName: "TSMC",
        legalEntities: [
          createAliasRecord(
            "company:TSMC",
            "Taiwan Semiconductor Manufacturing Company Limited",
            "legal_entity",
            { isPrimary: true, source: "registry" },
          ),
        ],
        brands: [],
        aliases: [createAliasRecord("company:TSMC", "TSMC", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 0.86,
    },
  ],
  [
    "mp-materials",
    {
      id: "company:mp-materials",
      ticker: "MP",
      name: "MP Materials",
      canonicalName: "MP Materials",
      displayName: "MP Materials",
      companyType: "raw_material",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "Rare earth materials producer",
      aliases: [],
      entityProfile: createDefaultEntityProfile("company:mp-materials", "MP Materials", []),
      importanceScore: 0.62,
    },
  ],
  [
    "openai",
    {
      id: "company:openai",
      name: "OpenAI",
      canonicalName: "OpenAI",
      displayName: "OpenAI",
      companyType: "service_provider",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "AI model developer and platform provider",
      aliases: [],
      entityProfile: createDefaultEntityProfile("company:openai", "OpenAI", []),
      importanceScore: 0.78,
    },
  ],
  [
    "g42",
    {
      id: "company:g42",
      name: "G42",
      canonicalName: "G42",
      displayName: "G42",
      companyType: "service_provider",
      country: "AE",
      isMag7: false,
      marketCapUsd: null,
      description: "Digital infrastructure and AI services company",
      aliases: [],
      entityProfile: createDefaultEntityProfile("company:g42", "G42", []),
      importanceScore: 0.58,
    },
  ],
  [
    "broadcom",
    {
      id: "company:AVGO",
      ticker: "AVGO",
      name: "Broadcom",
      canonicalName: "Broadcom",
      displayName: "Broadcom",
      companyType: "supplier",
      country: "US",
      isMag7: false,
      marketCapUsd: null,
      description: "Semiconductor and infrastructure supplier",
      aliases: ["Broadcom Inc."],
      entityProfile: {
        canonicalName: "Broadcom",
        displayName: "Broadcom",
        legalEntities: [
          createAliasRecord("company:AVGO", "Broadcom Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [],
        aliases: [
          createAliasRecord("company:AVGO", "Broadcom", "canonical", { isPrimary: true, source: "registry" }),
        ],
      },
      importanceScore: 0.76,
    },
  ],
  [
    "dhl-express",
    {
      id: "company:dhl-express",
      name: "DHL Express",
      canonicalName: "DHL Express",
      displayName: "DHL Express",
      companyType: "logistics",
      country: "DE",
      isMag7: false,
      marketCapUsd: null,
      description: "International logistics provider",
      aliases: ["DHL"],
      entityProfile: {
        canonicalName: "DHL Express",
        displayName: "DHL Express",
        legalEntities: [],
        brands: [],
        aliases: [
          createAliasRecord("company:dhl-express", "DHL Express", "canonical", {
            isPrimary: true,
            source: "registry",
          }),
          createAliasRecord("company:dhl-express", "DHL", "short_name", { source: "registry" }),
        ],
      },
      importanceScore: 0.54,
    },
  ],
  [
    "nvidia",
    {
      id: "company:NVDA",
      ticker: "NVDA",
      name: "NVIDIA",
      canonicalName: "NVIDIA",
      displayName: "NVIDIA",
      companyType: "supplier",
      country: "US",
      isMag7: true,
      marketCapUsd: 3300000000000,
      description: "Accelerated computing and AI infrastructure company",
      aliases: ["NVIDIA Corporation"],
      entityProfile: {
        canonicalName: "NVIDIA",
        displayName: "NVIDIA",
        legalEntities: [
          createAliasRecord("company:NVDA", "NVIDIA Corporation", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [],
        aliases: [createAliasRecord("company:NVDA", "NVIDIA", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 1,
    },
  ],
  [
    "tesla",
    {
      id: "company:TSLA",
      ticker: "TSLA",
      name: "Tesla",
      canonicalName: "Tesla",
      displayName: "Tesla",
      companyType: "public_company",
      country: "US",
      isMag7: true,
      marketCapUsd: 700000000000,
      description: "Electric vehicles, energy storage, and manufacturing systems",
      aliases: ["Tesla, Inc."],
      entityProfile: {
        canonicalName: "Tesla",
        displayName: "Tesla",
        legalEntities: [
          createAliasRecord("company:TSLA", "Tesla, Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [],
        aliases: [createAliasRecord("company:TSLA", "Tesla", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 1,
    },
  ],
  [
    "goertek",
    {
      id: "company:goertek",
      name: "Goertek",
      canonicalName: "Goertek",
      displayName: "Goertek",
      companyType: "manufacturer",
      country: "CN",
      isMag7: false,
      marketCapUsd: null,
      description: "Electronics manufacturing and components supplier",
      aliases: ["Goertek Inc."],
      entityProfile: {
        canonicalName: "Goertek",
        displayName: "Goertek",
        legalEntities: [
          createAliasRecord("company:goertek", "Goertek Inc.", "legal_entity", {
            isPrimary: true,
            source: "registry",
          }),
        ],
        brands: [],
        aliases: [createAliasRecord("company:goertek", "Goertek", "canonical", { isPrimary: true, source: "registry" })],
      },
      importanceScore: 0.56,
    },
  ],
]);

function slugifyAlias(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "alias";
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function createAliasRecord(
  entityId: string,
  name: string,
  aliasType: EntityAliasRecord["aliasType"],
  overrides: Partial<EntityAliasRecord> = {},
): EntityAliasRecord {
  return {
    id: overrides.id ?? `alias:${entityId}:${slugifyAlias(name)}`,
    name,
    normalizedName: overrides.normalizedName ?? normalizeName(name),
    aliasType,
    language: overrides.language ?? null,
    isPrimary: overrides.isPrimary ?? false,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
    validFromResolution: overrides.validFromResolution ?? null,
    validToResolution: overrides.validToResolution ?? null,
    source: overrides.source ?? null,
    notes: overrides.notes ?? null,
  };
}

function createDefaultEntityProfile(entityId: string, canonicalName: string, aliases: string[]): EntityProfile {
  return {
    canonicalName,
    displayName: canonicalName,
    legalEntities: aliases.map((alias, index) =>
      createAliasRecord(entityId, alias, "legal_entity", {
        isPrimary: index === 0,
        source: "registry",
      }),
    ),
    brands: [],
    aliases: [
      createAliasRecord(entityId, canonicalName, "canonical", {
        isPrimary: true,
        source: "registry",
      }),
    ],
  };
}

function dedupeAliasRecords(records: EntityAliasRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = [
      record.aliasType,
      record.name.toLowerCase(),
      record.validFrom ?? "",
      record.validTo ?? "",
      record.notes ?? "",
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function projectLegacyAliases(profile: EntityProfile, fallbackAliases: string[]) {
  const ordered = [
    ...profile.aliases.filter((alias) => alias.aliasType === "canonical"),
    ...profile.aliases.filter((alias) => alias.aliasType === "short_name"),
    ...profile.aliases.filter((alias) => alias.aliasType === "historical"),
    ...profile.legalEntities,
    ...profile.brands,
  ]
    .map((alias) => alias.name)
    .filter(Boolean);

  return [...new Set([...ordered, ...fallbackAliases])];
}

function mergeEntityProfile(base: EntityProfile, ref: ImportEntityRef | undefined, sourceLabel: string): EntityProfile {
  if (!ref) {
    return {
      ...base,
      legalEntities: dedupeAliasRecords(base.legalEntities),
      brands: dedupeAliasRecords(base.brands),
      aliases: dedupeAliasRecords(base.aliases),
    };
  }

  const aliases = [...base.aliases];
  const aliasType = ref.display_name === base.canonicalName ? "canonical" : "short_name";
  aliases.push(
    createAliasRecord(ref.entity_id, ref.display_name, aliasType, {
      isPrimary: ref.display_name === base.displayName,
      source: sourceLabel,
    }),
  );

  const legalEntities = [...base.legalEntities];
  if (ref.legal_entity_name) {
    legalEntities.push(
      createAliasRecord(ref.entity_id, ref.legal_entity_name, "legal_entity", {
        isPrimary: legalEntities.length === 0,
        source: sourceLabel,
      }),
    );
  }

  return {
    canonicalName: base.canonicalName,
    displayName: ref.display_name || base.displayName,
    legalEntities: dedupeAliasRecords(legalEntities),
    brands: dedupeAliasRecords(base.brands),
    aliases: dedupeAliasRecords(aliases),
  };
}

function deriveFallbackCompany(slug: string, name: string, isMag7 = false): CompanySeed {
  return {
    id: isMag7 ? `company:${slug.toUpperCase()}` : `company:${slug}`,
    ticker: isMag7 ? slug.toUpperCase() : undefined,
    name,
    canonicalName: name,
    displayName: name,
    companyType: isMag7 ? "public_company" : "supplier",
    country: "unknown",
    isMag7,
    marketCapUsd: null,
    description: null,
    aliases: [],
    entityProfile: createDefaultEntityProfile(
      isMag7 ? `company:${slug.toUpperCase()}` : `company:${slug}`,
      name,
      [],
    ),
    importanceScore: isMag7 ? 1 : 0.5,
  };
}

function getCompanySeed(slug: string, name: string, isMag7: boolean) {
  return companyRegistry.get(slug) ?? deriveFallbackCompany(slug, name, isMag7);
}

function normalizeLegacyResolutionValue(value: unknown) {
  if (value === "month-normalized") {
    return "month";
  }

  if (value === "metadata_date_published") {
    return "published_at";
  }

  if (value === "retrieved_at_only") {
    return "undated";
  }

  if (value === "reported_period_end") {
    return "filing_period";
  }

  if (value === "retrieved_at_surrogate") {
    return "undated";
  }

  return value;
}

function normalizeLegacyImportRecord(record: unknown) {
  if (!record || typeof record !== "object") {
    return record;
  }

  const original = record as Record<string, unknown>;
  const normalized = { ...original };

  for (const key of [
    "evidence_date_resolution",
    "valid_from_resolution",
    "valid_to_resolution",
    "published_at_resolution",
    "coverage_start_resolution",
    "coverage_end_resolution",
  ]) {
    if (key in normalized) {
      normalized[key] = normalizeLegacyResolutionValue(normalized[key]);
    }
  }

  if (original.evidence_date_resolution === "month-normalized") {
    normalized.evidence_date_normalized =
      normalized.evidence_date_normalized ??
      (typeof normalized.evidence_date === "string" ? normalized.evidence_date : null);
    normalized.evidence_date_is_normalized = normalized.evidence_date_is_normalized ?? true;
  }

  return normalized;
}

function buildImportCompanyNode(seed: CompanySeed, ref: ImportEntityRef | undefined, sourceLabel: string): ImportCompanyNode {
  const entityProfile = mergeEntityProfile(seed.entityProfile, ref, sourceLabel);
  const canonicalName = ref?.entity_id === seed.id ? seed.canonicalName : seed.canonicalName;
  const displayName = ref?.display_name ?? seed.displayName;
  const aliases = projectLegacyAliases(entityProfile, seed.aliases);
  const searchAliases = [...new Set([
    seed.name,
    canonicalName,
    displayName,
    ...aliases,
    ...entityProfile.legalEntities.map((alias) => alias.normalizedName),
    ...entityProfile.brands.map((alias) => alias.normalizedName),
    ...entityProfile.aliases.map((alias) => alias.normalizedName),
  ])];

  return {
    ...seed,
    canonicalName,
    displayName,
    aliases,
    entityProfile: {
      ...entityProfile,
      displayName,
    },
    entityType: "Company",
    active: true,
    searchAliases,
    entityProfileJson: JSON.stringify({
      ...entityProfile,
      displayName,
    }),
  };
}

export async function readNormalizedJsonlFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const contents = await readFile(filePath, "utf8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parsed = normalizeLegacyImportRecord(JSON.parse(line) as unknown);
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
    readNormalizedJsonlFile(relationFile, standardizedImportRelationRecordSchema),
    readNormalizedJsonlFile(evidenceFile, standardizedImportEvidenceRecordSchema),
  ]);

  return {
    relations,
    evidence,
  };
}

export function prepareNormalizedImport(pkg: NormalizedImportPackage): PreparedNormalizedImport {
  const relations = pkg.relations.map((relation) =>
    standardizedImportRelationRecordSchema.parse(
      normalizeLegacyImportRecord(relation),
    ) as StandardizedImportRelationRecord,
  );
  const evidence = pkg.evidence.map((item) =>
    standardizedImportEvidenceRecordSchema.parse(
      normalizeLegacyImportRecord(item),
    ) as StandardizedImportEvidenceRecord,
  );
  const companyMap = new Map<string, ImportCompanyNode>();
  const snapshotMap = new Map<string, ImportSnapshotNode>();

  for (const relation of relations) {
    const companySeed = getCompanySeed(relation.company_slug, relation.company, true);
    const supplierSeed = getCompanySeed(relation.supplier_slug, relation.supplier, false);

    companyMap.set(
      companySeed.id,
      buildImportCompanyNode(
        companyMap.get(companySeed.id) ?? companySeed,
        relation.company_entity_ref,
        "relation.company_entity_ref",
      ),
    );
    companyMap.set(
      supplierSeed.id,
      buildImportCompanyNode(
        companyMap.get(supplierSeed.id) ?? supplierSeed,
        relation.supplier_entity_ref,
        "relation.supplier_entity_ref",
      ),
    );

    const existingSnapshot = snapshotMap.get(relation.snapshot_id);
    const scope = new Set(existingSnapshot?.scope ?? []);
    scope.add(companySeed.id);
    snapshotMap.set(relation.snapshot_id, {
      id: relation.snapshot_id,
      version: relation.snapshot_id.replace("snapshot:", "").replace(/-/g, "."),
      status: "published",
      publishedAt: relation.last_verified_at,
      scope: [...scope],
      notes: "Imported from normalized Mag7 sample package",
    });
  }

  return {
    companies: [...companyMap.values()],
    snapshots: [...snapshotMap.values()],
    relations: relations.map((relation) => ({
      id: relation.relation_id,
      relationshipType: relation.relationship_type,
      relationshipSubtype: relation.relationship_subtype,
      tier: relation.tier,
      depthFromMag7: relation.depth_from_mag7,
      confidence: relation.confidence_label,
      confidenceScore: relation.confidence_score,
      summary: relation.summary,
      productScope: relation.product_scope,
      notes: relation.notes ?? null,
      evidenceIds: relation.evidence_ids,
      evidenceCount: relation.evidence_ids.length,
      snapshotId: relation.snapshot_id,
      status: relation.status,
      evidenceDate: relation.evidence_date,
      evidenceDateResolution: normalizeLegacyResolutionValue(relation.evidence_date_resolution) as DateResolution,
      evidenceDateNormalized: relation.evidence_date_normalized ?? null,
      evidenceDateIsNormalized: relation.evidence_date_is_normalized ?? false,
      validFrom: relation.valid_from ?? null,
      validFromResolution:
        relation.valid_from_resolution == null
          ? null
          : normalizeLegacyResolutionValue(relation.valid_from_resolution) as DateResolution,
      validTo: relation.valid_to ?? null,
      validToResolution:
        relation.valid_to_resolution == null
          ? null
          : normalizeLegacyResolutionValue(relation.valid_to_resolution) as DateResolution,
      validityNote: relation.validity_note ?? null,
      sourceMethod: relation.source_method,
      sourceCount: relation.source_count,
      lineageKey: relation.lineage_key,
      primaryEvidenceId: relation.primary_evidence_id,
      evidenceExcerpt: relation.evidence_excerpt,
      sourceUrl: relation.source_url,
      sourceReportPath: relation.source_report_path,
      lastVerifiedAt: relation.last_verified_at,
    })),
    relationEdges: relations.map((relation) => ({
      relationId: relation.relation_id,
      sourceCompanyId: getCompanySeed(relation.supplier_slug, relation.supplier, false).id,
      targetCompanyId: getCompanySeed(relation.company_slug, relation.company, true).id,
      snapshotId: relation.snapshot_id,
    })),
    evidence: evidence.map((evidence) => ({
      id: evidence.evidence_id,
      sourceType: evidence.source_type,
      title: evidence.title,
      publisher: evidence.publisher,
      url: evidence.source_url,
      publishedAt: evidence.published_at,
      publishedAtResolution: normalizeLegacyResolutionValue(evidence.published_at_resolution) as DateResolution,
      coverageStart: evidence.coverage_start ?? null,
      coverageEnd: evidence.coverage_end ?? null,
      coverageStartResolution:
        evidence.coverage_start_resolution == null
          ? null
          : normalizeLegacyResolutionValue(evidence.coverage_start_resolution) as DateResolution,
      coverageEndResolution:
        evidence.coverage_end_resolution == null
          ? null
          : normalizeLegacyResolutionValue(evidence.coverage_end_resolution) as DateResolution,
      retrievedAt: evidence.retrieved_at,
      excerpt: evidence.excerpt,
      pageRef: evidence.page_ref ?? null,
      language: evidence.language ?? "en",
      hash: evidence.evidence_id,
      sourceDomain: evidence.source_domain,
      citationText: evidence.citation_text,
      reliabilityTier: evidence.reliability_tier,
      licenseNote: evidence.license_note ?? null,
      parserVersion: evidence.parser_version,
      sourceReportPath: evidence.source_report_path,
      notes: evidence.notes ?? null,
    })),
    evidenceBindings: evidence.map((evidence) => ({
      relationId: evidence.relation_id,
      evidenceId: evidence.evidence_id,
    })),
  };
}
