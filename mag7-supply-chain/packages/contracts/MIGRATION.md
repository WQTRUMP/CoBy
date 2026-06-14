# Contracts Migration

`packages/contracts` is now the canonical source for:

- company list, detail, and overview API DTOs
- subgraph and relation-evidence API DTOs
- lossless normalized relation import records
- normalized evidence records used by the importer

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
   - schema version moved from `mag7-supply-chain.import-relations.v1` to `mag7-supply-chain.import-relations.v2`.
   - `product_scope` is now a required array.
   - normalized relation records preserve `relation_id`, `evidence_ids`, `primary_evidence_id`, `relationship_subtype`, `source_method`, `source_count`, `status`, `summary`, `lineage_key`, `source_report_path`, and `last_verified_at`.
   - `relationship_type` is intentionally open-string in the shared contract so newly promoted edge categories do not get blocked by stale frontend/backend enums.

6. Package consumption
   - frontend and backend must import contracts via `@mag7/contracts`, not `packages/contracts/src/index`.
   - Neo4j persistence should bind companies and evidence through `SOURCE_OF`, `TARGET_OF`, and `SUPPORTED_BY` edges; do not depend on mirrored join fields in API DTOs or query consumers.

## Frontend Follow-up

- `src/contracts/api.ts` should stay a thin re-export layer only while `00769a61` is in flight.
- UI adapters must treat company list, company detail, and company overview as separate payloads.
- Any UI code that assumed `relation.productScope` was a string must join the array explicitly.
- Evidence drawers should use `relation.evidence` or `/relations/:id/evidence`; do not reconstruct grouping from top-level `subgraph.evidence`.
