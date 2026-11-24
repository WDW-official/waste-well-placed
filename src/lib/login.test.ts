import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  rateLimit: vi.fn(),
  session: vi.fn(),
  select: vi.fn(),
  compare: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ connectDB: mocks.connect }));
vi.mock("@/lib/auth", () => ({ createSession: mocks.session }));
vi.mock("@/lib/models", () => ({
  User: { findOne: () => ({ select: mocks.select }) },
}));
vi.mock("@/lib/operations/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
import { POST } from "@/app/api/auth/login/route";

function request() {
  return new Request("https://example.test/api/auth/login", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@example.test",
      password: "test-password",
    }),
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MONGODB_URI", "mongodb://example.test/test-database");
  vi.stubEnv("SESSION_SECRET", "a".repeat(32));
  vi.spyOn(console, "error").mockImplementation(() => {});
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.select.mockResolvedValue({
    id: "507f1f77bcf86cd799439011",
    email: "admin@example.test",
    name: "Admin",
    role: "admin",
    passwordHash: "test-hash",
  });
  mocks.compare.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("production login diagnostics", () => {
  it("rejects missing or short session secrets before querying the database", async () => {
    for (const secret of [undefined, "too-short"]) {
      vi.stubEnv("SESSION_SECRET", secret);
      expect((await POST(request())).status).toBe(503);
    }
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain(
      "SESSION_SECRET must contain at least 32 characters",
    );
  });
  it("reports missing database configuration without exposing credentials", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Sign-in is unavailable. Please contact support.",
    });
  });
  it("logs the failing database stage without logging its connection string", async () => {
    mocks.connect.mockRejectedValue(
      new Error("mongodb://private-credentials@example.test"),
    );
    expect((await POST(request())).status).toBe(503);
    const output = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(output).toContain("database connection");
    expect(output).not.toContain("private-credentials");
  });
  it("creates a session for valid credentials in production", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.session).toHaveBeenCalledWith({
      id: "507f1f77bcf86cd799439011",
      role: "admin",
    });
  });
  it("keeps incorrect passwords and rate limits distinct from server failures", async () => {
    mocks.compare.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    mocks.rateLimit.mockRejectedValue(
      Object.assign(new Error("Too many requests"), { status: 429 }),
    );
    expect((await POST(request())).status).toBe(429);
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
