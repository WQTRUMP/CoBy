import { createServer } from "node:net";
import { once } from "node:events";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

import { afterAll, describe, expect, it } from "vitest";

const backendDir = "/workspace/project/mag7-supply-chain/backend";
type ServerChildProcess = ChildProcessByStdio<null, Readable, Readable>;
const serverEntrypointArgs = ["--import", "tsx", "src/server.ts"];
const HEALTH_CHECK_DEADLINE_MS = 8_000;
const HEALTH_CHECK_RETRY_MS = 100;
const SERVER_STARTUP_BUDGET_MS = 7_500;

const childProcesses = new Set<ServerChildProcess>();

async function allocatePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");

  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("failed to allocate a TCP port for runtime test");
  }

  const { port } = address;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return port;
}

function captureOutput(child: ServerChildProcess) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

async function waitForHealth(child: ServerChildProcess, port: number, output: { stdout: string; stderr: string }) {
  const deadline = Date.now() + HEALTH_CHECK_DEADLINE_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `server exited before health check completed (code ${child.exitCode})\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      );
    }

    try {
      return await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, HEALTH_CHECK_RETRY_MS);
      });
    }
  }

  throw new Error(`server did not start listening in time\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`);
}

async function startRuntimeServer(envOverrides: NodeJS.ProcessEnv) {
  const port = await allocatePort();
  const child = spawn(process.execPath, serverEntrypointArgs, {
    cwd: backendDir,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  childProcesses.add(child);

  return {
    port,
    child,
    output: captureOutput(child),
  };
}

async function withRuntimeServer<T>(
  envOverrides: NodeJS.ProcessEnv,
  run: (server: Awaited<ReturnType<typeof startRuntimeServer>>) => Promise<T>,
) {
  const server = await startRuntimeServer(envOverrides);

  try {
    return await run(server);
  } finally {
    await stopProcess(server.child);
  }
}

async function stopProcess(child: ServerChildProcess) {
  if (child.exitCode !== null) {
    childProcesses.delete(child);
    return;
  }

  child.kill("SIGTERM");
  const exitPromise = once(child, "exit").catch(() => undefined);
  const timeout = setTimeout(() => {
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }, 2_000);

  try {
    await exitPromise;
  } finally {
    clearTimeout(timeout);
    childProcesses.delete(child);
  }
}

afterAll(async () => {
  await Promise.all([...childProcesses].map((child) => stopProcess(child)));
});

describe("runtime startup", () => {
  it(
    "defaults to live mode and returns 503 business errors instead of mock when dependencies are missing",
    async () =>
      withRuntimeServer(
        {
        REDIS_URL: "redis://10.255.255.1:6390",
        NEO4J_URI: "",
      },
        async ({ child, output, port }) => {
          const startedAt = Date.now();
          const healthResponse = await waitForHealth(child, port, output);

          expect(healthResponse.status).toBe(200);
          expect(
            Date.now() - startedAt,
            `server startup exceeded budget\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
          ).toBeLessThan(SERVER_STARTUP_BUDGET_MS);

          const healthPayload = (await healthResponse.json()) as {
            status: string;
            runtimeMode: string;
            repositoryMode: string;
            dependencies: {
              neo4j: {
                status: string;
                required: boolean;
                detail: string;
              };
              redis: {
                status: string;
                required: boolean;
                enabled: boolean;
                detail: string;
              };
            };
          };

          expect(healthPayload).toMatchObject({
            status: "degraded",
            runtimeMode: "live",
            repositoryMode: "neo4j",
            dependencies: {
              neo4j: {
                status: "not_configured",
                required: true,
                detail: "unavailable",
              },
              redis: {
                status: "down",
                required: true,
                enabled: false,
                detail: "unavailable",
              },
            },
          });

          const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
          expect(companiesResponse.status).toBe(503);
          await expect(companiesResponse.json()).resolves.toMatchObject({
            error: "dependency_unavailable",
            dependency: "neo4j",
            message: "Live graph mode requires a reachable Neo4j dependency.",
            detail: "Neo4j dependency is currently unavailable.",
          });
        },
      ),
    15_000,
  );

  it(
    "allows explicit prototype mode to serve mock data when Neo4j and Redis are absent",
    async () =>
      withRuntimeServer(
        {
          GRAPH_RUNTIME_MODE: "prototype",
          REDIS_URL: "",
          NEO4J_URI: "",
        },
        async ({ child, output, port }) => {
          const healthResponse = await waitForHealth(child, port, output);

          expect(healthResponse.status).toBe(200);

          const healthPayload = (await healthResponse.json()) as {
            runtimeMode: string;
            repositoryMode: string;
            contracts: {
              mockGraphBoundary: boolean;
            };
            dependencies: {
              neo4j: {
                status: string;
                required: boolean;
              };
              redis: {
                status: string;
                required: boolean;
              };
            };
          };
          expect(healthPayload).toMatchObject({
            runtimeMode: "prototype",
            repositoryMode: "mock",
            contracts: {
              mockGraphBoundary: true,
            },
            dependencies: {
              neo4j: {
                status: "not_configured",
                required: false,
              },
              redis: {
                status: "not_configured",
                required: false,
              },
            },
          });

          const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
          expect(companiesResponse.status).toBe(200);
          await expect(companiesResponse.json()).resolves.toMatchObject({
            source: "mock",
          });
        },
      ),
    15_000,
  );

  it(
    "keeps live mode in explicit not_configured semantics when Neo4j and Redis are both missing",
    async () =>
      withRuntimeServer(
        {
          REDIS_URL: "",
          NEO4J_URI: "",
        },
        async ({ child, output, port }) => {
          const healthResponse = await waitForHealth(child, port, output);

          expect(healthResponse.status).toBe(200);

          const healthPayload = (await healthResponse.json()) as {
            status: string;
            runtimeMode: string;
            repositoryMode: string;
            dependencies: {
              neo4j: {
                status: string;
                required: boolean;
                detail: string;
              };
              redis: {
                status: string;
                required: boolean;
                enabled: boolean;
                detail: string;
              };
            };
          };

          expect(healthPayload).toMatchObject({
            status: "degraded",
            runtimeMode: "live",
            repositoryMode: "neo4j",
            dependencies: {
              neo4j: {
                status: "not_configured",
                required: true,
                detail: "unavailable",
              },
              redis: {
                status: "not_configured",
                required: true,
                enabled: false,
                detail: "unavailable",
              },
            },
          });

          const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
          expect(companiesResponse.status).toBe(503);
          await expect(companiesResponse.json()).resolves.toMatchObject({
            error: "dependency_unavailable",
            dependency: "neo4j",
            message: "Live graph mode requires a reachable Neo4j dependency.",
            detail: "Neo4j dependency is currently unavailable.",
          });
        },
      ),
    15_000,
  );

  it(
    "refuses live startup semantics when Neo4j credentials are omitted even if NEO4J_URI is set",
    async () =>
      withRuntimeServer(
        {
          NEO4J_URI: "neo4j://127.0.0.1:7687",
          NEO4J_USERNAME: "",
          NEO4J_PASSWORD: "",
          REDIS_URL: "",
        },
        async ({ child, output, port }) => {
          const healthResponse = await waitForHealth(child, port, output);

          expect(healthResponse.status).toBe(200);

          const healthPayload = (await healthResponse.json()) as {
            status: string;
            runtimeMode: string;
            repositoryMode: string;
            dependencies: {
              neo4j: {
                status: string;
                required: boolean;
                detail: string;
              };
            };
          };

          expect(healthPayload).toMatchObject({
            status: "degraded",
            runtimeMode: "live",
            repositoryMode: "neo4j",
            dependencies: {
              neo4j: {
                status: "not_configured",
                required: true,
                detail: "unavailable",
              },
            },
          });

          const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
          expect(companiesResponse.status).toBe(503);
          await expect(companiesResponse.json()).resolves.toMatchObject({
            error: "dependency_unavailable",
            dependency: "neo4j",
            message: "Live graph mode requires a reachable Neo4j dependency.",
            detail: "Neo4j dependency is currently unavailable.",
          });
        },
      ),
    15_000,
  );
});
