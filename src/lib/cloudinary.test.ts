import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudinaryUploadError, configureCloudinary } from "./cloudinary";
import { errorResponse } from "./http";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Cloudinary configuration failures", () => {
  it("returns a service error without exposing provider signature details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const providerError = {
      http_code: 401,
      message: "Invalid Signature sensitive-provider-details",
    };
    const response = errorResponse(cloudinaryUploadError(providerError));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is unavailable. Please contact support.",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(providerError.message);
  });

  it("preserves other provider errors", () => {
    const error = { http_code: 400, message: "Invalid image file" };
    expect(cloudinaryUploadError(error)).toBe(error);
  });

  it("rejects blank credentials before sending a request", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "example");
    vi.stubEnv("CLOUDINARY_API_KEY", "123456");
    vi.stubEnv("CLOUDINARY_API_SECRET", "   ");
    expect(() => configureCloudinary()).toThrow(
      "File storage is unavailable. Please contact support.",
    );
  });
});
