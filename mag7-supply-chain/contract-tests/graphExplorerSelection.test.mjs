import assert from "node:assert/strict";
import test from "node:test";

import { resolveFallbackCompanyId } from "../.tmp-contract-tests/src/hooks/graphExplorerSelection.js";
import { adaptCompanyOptions } from "../.tmp-contract-tests/src/adapters/graphExplorerAdapter.js";
import { getCompaniesResponse } from "../.tmp-contract-tests/src/mocks/mockSupplyChain.js";

test("falls back to the first available Mag7 company when no company is selected", () => {
  const companies = adaptCompanyOptions({
    ...getCompaniesResponse(),
    items: [
      {
        id: "company:AAPL",
        ticker: "AAPL",
        name: "Apple",
        isMag7: true,
        marketCapUsd: 3000000000000,
        primaryRegion: "North America",
        activeSnapshotId: "snapshot:published",
      },
      {
        id: "company:NVDA",
        ticker: "NVDA",
        name: "NVIDIA",
        isMag7: true,
        marketCapUsd: 2800000000000,
        primaryRegion: "North America",
        activeSnapshotId: "snapshot:published",
      },
    ],
  });

  assert.equal(resolveFallbackCompanyId(companies), "company:AAPL");
});

test("skips a missing requested company and selects another available Mag7 record", () => {
  const companies = adaptCompanyOptions({
    ...getCompaniesResponse(),
    items: [
      {
        id: "company:AAPL",
        ticker: "AAPL",
        name: "Apple",
        isMag7: true,
        marketCapUsd: 3000000000000,
        primaryRegion: "North America",
        activeSnapshotId: "snapshot:published",
      },
      {
        id: "company:MSFT",
        ticker: "MSFT",
        name: "Microsoft",
        isMag7: true,
        marketCapUsd: 3100000000000,
        primaryRegion: "North America",
        activeSnapshotId: "snapshot:published",
      },
    ],
  });

  assert.equal(resolveFallbackCompanyId(companies, "company:TSLA"), "company:AAPL");
});
