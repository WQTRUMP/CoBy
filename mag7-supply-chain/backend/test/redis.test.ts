import { describe, expect, it, vi } from "vitest";

import { createCacheClient, type RedisClientLike } from "../src/lib/redis.js";

function createRedisStub(overrides: Partial<RedisClientLike> = {}): RedisClientLike {
  return {
    isOpen: true,
    on: vi.fn(),
    connect: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1),
    ping: vi.fn(async () => "PONG"),
    quit: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function waitFor<T>(callback: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await callback();
    if (predicate(value)) {
      return value;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  return callback();
}

describe("createCacheClient", () => {
  it("falls back to disabled cache when configured redis is unreachable at startup", async () => {
    const client = await createCacheClient({
      url: "redis://127.0.0.1:6379",
      createClient: () =>
        createRedisStub({
          connect: vi.fn(async () => {
            throw new Error("connect ECONNREFUSED 127.0.0.1:6379");
          }),
        }),
    });

    await waitFor(async () => client.enabled, (enabled) => enabled === false);
    expect(client.enabled).toBe(false);
    expect(await client.get("companies:search")).toBeNull();
    await expect(client.set("companies:search", "payload", 60)).resolves.toBeUndefined();
    await expect(waitFor(() => client.health(), (health) => health.detail.includes("cache disabled"))).resolves.toMatchObject({
      status: "down",
      enabled: false,
      detail: expect.stringContaining("cache disabled"),
    });
  });

  it("degrades an active redis client into noop mode after runtime failures", async () => {
    const redisStub = createRedisStub({
      get: vi.fn(async () => {
        throw new Error("read ECONNRESET");
      }),
    });
    const client = await createCacheClient({
      url: "redis://127.0.0.1:6379",
      createClient: () => redisStub,
    });

    await expect(waitFor(() => client.health(), (health) => health.status === "up")).resolves.toMatchObject({
      status: "up",
      enabled: true,
    });
    await expect(client.get("graph:stats")).resolves.toBeNull();
    expect(client.enabled).toBe(false);
    await expect(client.set("graph:stats", "payload", 60)).resolves.toBeUndefined();
    await expect(client.health()).resolves.toMatchObject({
      status: "down",
      enabled: false,
      detail: expect.stringContaining("read ECONNRESET"),
    });
    expect(redisStub.quit).toHaveBeenCalledTimes(1);
  });
});
