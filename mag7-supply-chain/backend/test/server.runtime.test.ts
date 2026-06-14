import { once } from "node:events";
import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { promisify } from "node:util";
import type { Readable } from "node:stream";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const backendDir = "/workspace/project/mag7-supply-chain/backend";
type ServerChildProcess = ChildProcessByStdio<null, Readable, Readable>;
const execFileAsync = promisify(execFile);

const childProcesses = new Set<ServerChildProcess>();

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
  beforeAll(async () => {
    await execFileAsync("npm", ["run", "build"], {
      cwd: backendDir,
      env: process.env,
    });
  }, 30_000);

  it(
    "defaults to live mode and returns 503 business errors instead of mock when dependencies are missing",
    async () => {
      const port = 4311;
      const child = spawn(process.execPath, ["dist/backend/src/server.js"], {
        cwd: backendDir,
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(port),
          REDIS_URL: "redis://10.255.255.1:6390",
          NEO4J_URI: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      childProcesses.add(child);
      const startedAt = Date.now();

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const deadline = Date.now() + 8_000;
      let healthResponse: Response | null = null;

      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `server exited before health check completed (code ${child.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          );
        }

        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          break;
        } catch {
          await new Promise((resolve) => {
            setTimeout(resolve, 200);
          });
        }
      }

      expect(healthResponse, `server did not start listening in time\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
      expect(healthResponse!.status).toBe(200);
      expect(Date.now() - startedAt, `server startup exceeded budget\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBeLessThan(
        2_500,
      );

      const healthPayload = (await healthResponse!.json()) as {
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
            detail: expect.stringContaining("GRAPH_RUNTIME_MODE=live"),
          },
          redis: {
            status: "down",
            required: true,
            enabled: false,
            detail: expect.stringContaining("cache disabled"),
          },
        },
      });

      const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
      expect(companiesResponse.status).toBe(503);
      await expect(companiesResponse.json()).resolves.toMatchObject({
        error: "dependency_unavailable",
        dependency: "neo4j",
        message: "Live graph mode requires a reachable Neo4j dependency.",
        detail: expect.stringContaining("GRAPH_RUNTIME_MODE=live"),
      });
    },
    15_000,
  );

  it(
    "allows explicit prototype mode to serve mock data when Neo4j and Redis are absent",
    async () => {
      const port = 4312;
      const child = spawn(process.execPath, ["dist/backend/src/server.js"], {
        cwd: backendDir,
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(port),
          GRAPH_RUNTIME_MODE: "prototype",
          REDIS_URL: "",
          NEO4J_URI: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      childProcesses.add(child);

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const deadline = Date.now() + 8_000;
      let healthResponse: Response | null = null;

      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `server exited before prototype health check completed (code ${child.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          );
        }

        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          break;
        } catch {
          await new Promise((resolve) => {
            setTimeout(resolve, 200);
          });
        }
      }

      expect(healthResponse, `prototype server did not start listening in time\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
      expect(healthResponse!.status).toBe(200);

      const healthPayload = (await healthResponse!.json()) as {
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
    15_000,
  );

  it(
    "keeps live mode in explicit not_configured semantics when Neo4j and Redis are both missing",
    async () => {
      const port = 4313;
      const child = spawn(process.execPath, ["dist/backend/src/server.js"], {
        cwd: backendDir,
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: String(port),
          REDIS_URL: "",
          NEO4J_URI: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      childProcesses.add(child);

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const deadline = Date.now() + 8_000;
      let healthResponse: Response | null = null;

      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `server exited before live missing-dependency health check completed (code ${child.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          );
        }

        try {
          healthResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          break;
        } catch {
          await new Promise((resolve) => {
            setTimeout(resolve, 200);
          });
        }
      }

      expect(healthResponse, `live missing-dependency server did not start listening in time\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
      expect(healthResponse!.status).toBe(200);

      const healthPayload = (await healthResponse!.json()) as {
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
            detail: expect.stringContaining("GRAPH_RUNTIME_MODE=live"),
          },
          redis: {
            status: "not_configured",
            required: true,
            enabled: false,
            detail: expect.stringContaining("requires Redis for acceptance"),
          },
        },
      });

      const companiesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/companies?isMag7=true&page=1&pageSize=2`);
      expect(companiesResponse.status).toBe(503);
      await expect(companiesResponse.json()).resolves.toMatchObject({
        error: "dependency_unavailable",
        dependency: "neo4j",
        message: "Live graph mode requires a reachable Neo4j dependency.",
        detail: expect.stringContaining("GRAPH_RUNTIME_MODE=live"),
      });
    },
    15_000,
  );
});
