const DEFAULT_BACKEND_HOST = "127.0.0.1";
const DEFAULT_BACKEND_PORT = "4000";

export function normalizeGraphApiBaseUrl(value) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export function resolveLocalApiProxyTarget(env = {}) {
  const explicitBaseUrl = normalizeGraphApiBaseUrl(env.VITE_GRAPH_API_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const host = env.HOST?.trim() || DEFAULT_BACKEND_HOST;
  const port = env.PORT?.trim() || DEFAULT_BACKEND_PORT;
  return `http://${host}:${port}`;
}

export function createLocalApiProxy(env = {}) {
  const target = resolveLocalApiProxyTarget(env);

  if (!target) {
    return undefined;
  }

  return {
    "/api": {
      target,
      changeOrigin: true,
      secure: false,
    },
  };
}
