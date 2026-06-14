# Contracts Migration

`packages/contracts` is now the canonical source for:

- company list, detail, and overview API DTOs
- subgraph and relation-evidence API DTOs
- lossless normalized relation import records
- normalized evidence records used by the importer

## v3 Additions

`packages/contracts@v3` introduces canonical entity aliasing and explicit date-precision semantics without dropping `v2` package compatibility.

### New shared schemas

- `dateResolutionSchema`
  - canonical enum: `year | quarter | month | day | datetime | published_at | filing_period | undated`
- `aliasTypeSchema`
  - canonical enum: `canonical | legal_entity | brand | facility | historical | short_name | search_hint`
- `entityAliasRecordSchema`
  - typed alias rows with validity windows and source metadata
- `entityProfileSchema`
  - canonical entity naming bundle for company detail and graph responses

### Company DTO changes

- `CompanyDTO` / `CompanyDetailDTO` now allow:
  - `canonicalName`
  - `displayName`
  - `entityProfile`
- Legacy `aliases: string[]` remains for backward compatibility and should be treated as a flattened projection only.

### Relation DTO changes

- `RelationDTO` now allows:
  - `evidenceDate`
  - `evidenceDateResolution`
  - `evidenceDateNormalized`
  - `evidenceDateIsNormalized`
  - `validFromResolution`
  - `validToResolution`
  - `validityNote`
- `validFrom` / `validTo` remain optional legacy fields, but no longer imply evidence publication timing.

### Evidence DTO changes

- `EvidenceDTO` now includes:
  - `publishedAtResolution`
  - `coverageStart`
  - `coverageEnd`
  - `coverageStartResolution`
  - `coverageEndResolution`

### Import schema changes

- canonical request/package schema version is now `mag7-supply-chain.import-relations.v3`
- import relation records now support:
  - `company_entity_ref`
  - `supplier_entity_ref`
  - `evidence_date_normalized`
  - `evidence_date_is_normalized`
  - `valid_from`
  - `valid_from_resolution`
  - `valid_to`
  - `valid_to_resolution`
  - `validity_note`
- import evidence records now support:
  - `coverage_start`
  - `coverage_end`
  - `coverage_start_resolution`
  - `coverage_end_resolution`

## Breaking Changes

1. `GET /api/v1/companies`
   - `items` now use `CompanyListItemDTO`, not full company detail objects.
   - response includes `page`, `pageSize`, `total`, and `source`.

2. `GET /api/v1/companies/:companyId`
   - response item now uses `CompanyDetailDTO`.
   - `primaryRegion`, `activeSnapshotId`, `summary`, and `lastUpdatedAt` are part of the canonical detail shape.

3. `GET /api/v1/companies/:companyId/overview`
   - canonical fields now include `tier1SupplierCount`, `highRiskRelationCount`, `evidenceCoverage`, and `activeSnapshotId`.

4. `RelationDTO`
   - `productScope` is now `string[]`.
   - `relationshipSubtype`, `evidenceIds`, `primaryEvidenceId`, `sourceMethod`, `sourceCount`, `lineageKey`, and `lastVerifiedAt` are canonical.
   - `relation.evidence` remains the only embedded evidence location in the subgraph response.

5. Import schema
   - schema version moved from `mag7-supply-chain.import-relations.v2` to `mag7-supply-chain.import-relations.v3`.
   - `product_scope` is now a required array.
   - normalized relation records preserve `relation_id`, `evidence_ids`, `primary_evidence_id`, `relationship_subtype`, `source_method`, `source_count`, `status`, `summary`, `lineage_key`, `source_report_path`, and `last_verified_at`.
   - `relationship_type` is intentionally open-string in the shared contract so newly promoted edge categories do not get blocked by stale frontend/backend enums.
   - `company_entity_ref` and `supplier_entity_ref` are canonical in `v3`; `v2` inputs are auto-projected from `company/company_slug` and `supplier/supplier_slug`.
   - `month-normalized` is no longer a first-class resolution enum. Compatibility inputs are normalized to:
     - `evidence_date_resolution = "month"`
     - `evidence_date_normalized = evidence_date` unless already provided
     - `evidence_date_is_normalized = true`
   - importer/runtime layers should emit a warning when consuming legacy `month-normalized` inputs; the contract layer performs structural normalization only.

6. Package consumption
   - frontend and backend must import contracts via `@mag7/contracts`, not `packages/contracts/src/index`.
   - Neo4j persistence should bind companies and evidence through `SOURCE_OF`, `TARGET_OF`, and `SUPPORTED_BY` edges; do not depend on mirrored join fields in API DTOs or query consumers.

## Compatibility Notes

- `standardizedImportRelationRecordSchema` accepts both `v2`-style and `v3`-style payloads and returns the canonical `v3`-shaped object.
- `standardizedImportEvidenceRecordSchema` accepts legacy `month-normalized` resolution values and normalizes them to `month`.
- Existing API consumers that only read `aliases[]`, `validFrom`, or `validTo` continue to parse successfully.
- New consumers should prefer:
  - `displayName` over `aliases[0]`
  - `entityProfile` for legal entity / brand / facility labeling
  - `*Resolution` fields when rendering dates

## Frontend Follow-up

- `src/contracts/api.ts` should stay a thin re-export layer only while `00769a61` is in flight.
- UI adapters must treat company list, company detail, and company overview as separate payloads.
- Any UI code that assumed `relation.productScope` was a string must join the array explicitly.
- Evidence drawers should use `relation.evidence` or `/relations/:id/evidence`; do not reconstruct grouping from top-level `subgraph.evidence`.
