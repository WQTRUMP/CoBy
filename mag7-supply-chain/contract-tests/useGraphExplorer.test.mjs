import assert from "node:assert/strict";
import test from "node:test";

import { getGraphQueryKey } from "../.tmp-contract-tests/src/utils/graphQueryKey.js";

test("includes relationship filters in the graph explorer query key", () => {
  const baseline = getGraphQueryKey({
    companyId: "company:TSLA",
    depth: 2,
    search: "tesla",
    relationshipTypes: ["component_supply"],
    relationshipSubtype: "battery_cells",
  });

  const withDifferentTypes = getGraphQueryKey({
    companyId: "company:TSLA",
    depth: 2,
    search: "tesla",
    relationshipTypes: ["raw_material_supply"],
    relationshipSubtype: "battery_cells",
  });

  const withDifferentSubtype = getGraphQueryKey({
    companyId: "company:TSLA",
    depth: 2,
    search: "tesla",
    relationshipTypes: ["component_supply"],
    relationshipSubtype: "lfp_cells",
  });

  assert.notEqual(baseline, withDifferentTypes);
  assert.notEqual(baseline, withDifferentSubtype);
});

test("normalizes relationship type order for stable graph explorer query keys", () => {
  const left = getGraphQueryKey({
    companyId: "company:TSLA",
    depth: 3,
    relationshipTypes: ["raw_material_supply", "component_supply"],
    relationshipSubtype: "battery_cells",
  });

  const right = getGraphQueryKey({
    companyId: "company:TSLA",
    depth: 3,
    relationshipTypes: ["component_supply", "raw_material_supply"],
    relationshipSubtype: "battery_cells",
  });

  assert.equal(left, right);
});
