import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptIdentity, encryptIdentity, hashToken } from "./security";
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
describe("private identity data", () => {
  it("requires a dedicated encryption key", () => {
    vi.stubEnv("DRIVER_DATA_KEY", "");
    expect(() => encryptIdentity("secret-check-code")).toThrow(
      "not configured",
    );
  });
  it("encrypts with fresh nonces and authenticates ciphertext", () => {
    vi.stubEnv("DRIVER_DATA_KEY", "a".repeat(64));
    const one = encryptIdentity("secret-check-code");
    const two = encryptIdentity("secret-check-code");
    expect(one).not.toContain("secret-check-code");
    expect(one).not.toBe(two);
    expect(decryptIdentity(one)).toBe("secret-check-code");
    const parts = one.split(":");
    parts[2] = (parts[2][0] === "0" ? "1" : "0") + parts[2].slice(1);
    expect(() => decryptIdentity(parts.join(":"))).toThrow();
  });
  it("stores capability hashes rather than raw tokens", () => {
    expect(hashToken("private-link")).toHaveLength(64);
    expect(hashToken("private-link")).not.toBe("private-link");
  });
});
