import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("mongoose", () => ({ default: { connect: provider.connect } }));
import { connectDB } from "./db";
const cache = globalThis as typeof globalThis & { __mongoose?: unknown };

beforeEach(() => {
  delete cache.__mongoose;
  provider.connect.mockReset();
  vi.stubEnv("MONGODB_URI", "mongodb://example.test/test-database");
});
afterEach(() => {
  delete cache.__mongoose;
  vi.unstubAllEnvs();
});

describe("database connection cache", () => {
  it("shares successful connections across concurrent requests", async () => {
    const connection = { connection: { readyState: 1 } };
    provider.connect.mockResolvedValue(connection);
    expect(await Promise.all([connectDB(), connectDB()])).toEqual([
      connection,
      connection,
    ]);
    expect(await connectDB()).toBe(connection);
    expect(provider.connect).toHaveBeenCalledTimes(1);
  });
  it("allows a later request to retry after a failed connection", async () => {
    provider.connect
      .mockRejectedValueOnce(new Error("Temporary connection failure"))
      .mockResolvedValueOnce({ connected: true });
    const results = await Promise.allSettled([connectDB(), connectDB()]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(await connectDB()).toEqual({ connected: true });
    expect(provider.connect).toHaveBeenCalledTimes(2);
  });
  it("does not attempt a connection without a URI", async () => {
    vi.stubEnv("MONGODB_URI", undefined);
    await expect(connectDB()).rejects.toThrow("MONGODB_URI is not configured");
    expect(provider.connect).not.toHaveBeenCalled();
  });
});
