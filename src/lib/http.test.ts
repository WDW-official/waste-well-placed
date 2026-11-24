import { afterEach, describe, expect, it, vi } from "vitest";
import { errorResponse } from "./http";

afterEach(() => vi.restoreAllMocks());
describe("database outage responses", () => {
  it.each([
    "MongooseServerSelectionError",
    "MongoServerSelectionError",
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
  ])("returns a sanitized retryable response for %s", async (name) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error("Internal database hostname and connection details"),
      { name },
    );
    const response = errorResponse(error);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Service is temporarily unavailable. Please try again.",
    });
    expect(log).toHaveBeenCalledWith("Database connection unavailable:", {
      type: name,
    });
  });
});
