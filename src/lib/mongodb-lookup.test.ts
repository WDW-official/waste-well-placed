import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LookupOptions } from "node:dns";
const provider = vi.hoisted(() => ({
  lookup: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));
vi.mock("node:dns", () => ({
  lookup: provider.lookup,
  promises: { resolve4: provider.resolve4, resolve6: provider.resolve6 },
}));
import { mongodbLookup } from "./mongodb-lookup";

const missing = Object.assign(new Error("DNS lookup failed"), {
  code: "ENOTFOUND",
});
function resolve(
  host = "cluster.mongodb.net",
  options: LookupOptions = { all: true },
) {
  return new Promise((done) =>
    mongodbLookup(host, options, (error, address, family) =>
      done({ error, address, family }),
    ),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  provider.lookup.mockImplementation((_host, _options, callback) =>
    callback(missing),
  );
  provider.resolve4.mockResolvedValue(["192.0.2.10"]);
  provider.resolve6.mockRejectedValue(new Error("No IPv6 record"));
});
describe("MongoDB DNS fallback", () => {
  it("uses successful OS lookups without a DNS fallback", async () => {
    provider.lookup.mockImplementation((_host, _options, callback) =>
      callback(null, [{ address: "192.0.2.20", family: 4 }]),
    );
    expect(await resolve()).toMatchObject({
      error: null,
      address: [{ address: "192.0.2.20", family: 4 }],
    });
    expect(provider.resolve4).not.toHaveBeenCalled();
  });
  it("resolves Atlas hostnames directly after ENOTFOUND", async () => {
    expect(await resolve()).toMatchObject({
      error: null,
      address: [{ address: "192.0.2.10", family: 4 }],
    });
    expect(provider.resolve4).toHaveBeenCalledWith("cluster.mongodb.net");
  });
  it("preserves the single-address callback and requested address family", async () => {
    expect(await resolve("cluster.mongodb.net", { family: 4 })).toMatchObject({
      error: null,
      address: "192.0.2.10",
      family: 4,
    });
    expect(provider.resolve6).not.toHaveBeenCalled();
  });
  it("preserves errors for private hosts and unrelated lookup errors", async () => {
    expect(await resolve("private.internal")).toMatchObject({ error: missing });
    expect(provider.resolve4).not.toHaveBeenCalled();
    provider.lookup.mockImplementation((_host, _options, callback) =>
      callback(Object.assign(new Error("Access denied"), { code: "EACCES" })),
    );
    expect(await resolve()).toMatchObject({ error: { code: "EACCES" } });
    expect(provider.resolve4).not.toHaveBeenCalled();
  });
  it("returns the original error when direct DNS also fails", async () => {
    provider.resolve4.mockRejectedValue(new Error("No record"));
    expect(await resolve()).toMatchObject({ error: missing });
  });
});
