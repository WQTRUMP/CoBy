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
    "starts listening and reports degraded health when configured redis is unreachable",
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
      let response: Response | null = null;

      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          throw new Error(
            `server exited before health check completed (code ${child.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          );
        }

        try {
          response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          break;
        } catch {
          await new Promise((resolve) => {
            setTimeout(resolve, 200);
          });
        }
      }

      expect(response, `server did not start listening in time\nstdout:\n${stdout}\nstderr:\n${stderr}`).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(Date.now() - startedAt, `server startup exceeded budget\nstdout:\n${stdout}\nstderr:\n${stderr}`).toBeLessThan(
        2_500,
      );

      const payload = (await response!.json()) as {
        status: string;
        dependencies: {
          redis: {
            status: string;
            enabled: boolean;
            detail: string;
          };
        };
      };

      expect(payload).toMatchObject({
        status: "degraded",
        dependencies: {
          redis: {
            status: "down",
            enabled: false,
            detail: expect.stringContaining("cache disabled"),
          },
        },
      });
    },
    15_000,
  );
});
