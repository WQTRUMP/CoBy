import { createNeo4jBundle } from "../lib/neo4j.js";
import {
  resolveFullPackageLiveImportSpec,
  validateFullPackageLiveImportSpec,
  type FullPackageImportMode,
} from "../lib/full-package-live-import.js";
import {
  loadNormalizedImportPackage,
  prepareNormalizedImport,
} from "../lib/normalized-package.js";
import { validateNormalizedPackageManifest } from "../lib/normalized-package-validator.js";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const relationFile = readFlag("--relations");
const evidenceFile = readFlag("--evidence");
const manifestFile = readFlag("--manifest");
const mode = (readFlag("--mode") ?? "published") as FullPackageImportMode;

if ((!relationFile || !evidenceFile) && !manifestFile) {
  console.error(
    "Usage: npm run import:normalized -- --relations <relations.jsonl> --evidence <evidence.jsonl>\n" +
      "   or: npm run import:normalized -- --manifest <mag7-full-package-manifest.json> [--mode published|all-candidates]",
  );
  process.exit(1);
}

const neo4j = createNeo4jBundle();

try {
  const liveSpec = manifestFile
    ? await resolveFullPackageLiveImportSpec(manifestFile, mode)
    : null;

  if (liveSpec) {
    await validateFullPackageLiveImportSpec(liveSpec);
    await validateNormalizedPackageManifest(liveSpec.manifestPath);
  }

  const resolvedRelationFile = liveSpec?.relationFile ?? relationFile;
  const resolvedEvidenceFile = liveSpec?.evidenceFile ?? evidenceFile;
  if (!resolvedRelationFile || !resolvedEvidenceFile) {
    throw new Error("Both relation and evidence files must be resolved before import.");
  }

  const pkg = await loadNormalizedImportPackage(
    resolvedRelationFile,
    resolvedEvidenceFile,
    liveSpec?.manifestPath,
  );
  const prepared = prepareNormalizedImport(pkg);
  const summary = await neo4j.repository.importNormalizedPackage(prepared);

  console.log(
    JSON.stringify(
      {
        source: neo4j.repository.source,
        relationFile: resolvedRelationFile,
        evidenceFile: resolvedEvidenceFile,
        liveImport:
          liveSpec
            ? {
                manifestPath: liveSpec.manifestPath,
                mode: liveSpec.mode,
                packageSnapshotId: liveSpec.packageSnapshotId,
                authoritativeSnapshotId: liveSpec.authoritativeSnapshotId,
                expectedRelationCount: liveSpec.expectedRelationCount,
                expectedEvidenceCount: liveSpec.expectedEvidenceCount,
                candidateOnlyRelationCount: liveSpec.candidateOnlyRelationCount,
                candidateOnlyEvidenceCount: liveSpec.candidateOnlyEvidenceCount,
                governanceBaseline: {
                  path: liveSpec.governance.sourcePath,
                  authoritativeSnapshot: liveSpec.governance.authoritativeSnapshot,
                  activeCandidateShell: liveSpec.governance.activeCandidateShell,
                  published: liveSpec.governance.published,
                  allCandidates: liveSpec.governance.allCandidates,
                  candidateOnly: liveSpec.governance.candidateOnly,
                  realDataLaunch: liveSpec.governance.realDataLaunch,
                },
              }
            : null,
        ...summary,
      },
      null,
      2,
    ),
  );
} finally {
  await neo4j.close();
}
