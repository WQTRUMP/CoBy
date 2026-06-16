import {
  buildVersionManifestPath,
  inferPackageDirFromManifestPath,
  validateNormalizedPackageDirectory,
  validateNormalizedPackageManifest,
} from "../lib/normalized-package-validator.js";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const manifestPath = readFlag("--manifest");
const packageDir = readFlag("--package-dir");

if (!manifestPath && !packageDir) {
  console.error(
    "Usage: npm run validate:normalized-package -- --manifest <mag7-full-package-manifest.json>\n" +
      "   or: npm run validate:normalized-package -- --package-dir <package-directory>",
  );
  process.exit(1);
}

const summary = manifestPath
  ? await validateNormalizedPackageManifest(manifestPath)
  : await validateNormalizedPackageDirectory(packageDir as string);
const resolvedPackageDir = packageDir ?? inferPackageDirFromManifestPath(manifestPath as string);

console.log(
  JSON.stringify(
    {
      ok: true,
      validationSource: manifestPath ? "legacy_root_manifest" : "package_directory",
      packageDir: resolvedPackageDir,
      expectedVersionManifestPath: buildVersionManifestPath(resolvedPackageDir),
      packageSnapshotId: summary.manifest.packageSnapshotId,
      authoritativeRootSnapshot: summary.manifest.authoritativeRootSnapshot,
      schemaVersion: summary.schemaVersion,
      published: summary.published,
      allCandidates: summary.allCandidates,
      candidateOnly: summary.candidateOnly,
      manifestSource: {
        kind: summary.manifest.source,
        path: summary.manifest.sourcePath,
      },
    },
    null,
    2,
  ),
);
