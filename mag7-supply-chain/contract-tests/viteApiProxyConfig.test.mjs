import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalApiProxy,
  normalizeGraphApiBaseUrl,
  resolveLocalApiProxyTarget,
} from "../vite.api-proxy.config.mjs";

test("normalizes trailing slashes in explicit graph API base URLs", () => {
  assert.equal(normalizeGraphApiBaseUrl("https://api.example.com///"), "https://api.example.com");
  assert.equal(normalizeGraphApiBaseUrl("  "), "");
});

test("uses the explicit graph API base URL as the local /api proxy target when provided", () => {
  assert.equal(
    resolveLocalApiProxyTarget({
      VITE_GRAPH_API_BASE_URL: "https://api.example.com/base/",
      HOST: "127.0.0.1",
      PORT: "4000",
    }),
    "https://api.example.com/base",
  );
});

test("falls back to backend HOST and PORT for the local /api proxy target", () => {
  assert.deepEqual(
    createLocalApiProxy({
      HOST: "127.0.0.1",
      PORT: "4000",
    }),
    {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  );
});
