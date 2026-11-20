import { v2 as cloudinary } from "cloudinary";

function storageConfigurationError() {
  return Object.assign(
    new Error("File storage is unavailable. Please contact support."),
    { status: 503 },
  );
}

export function cloudinaryUploadError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "http_code" in error &&
    error.http_code === 401
  ) {
    console.error(
      "Cloudinary authentication failed. Check that CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET belong to the same product environment, then restart the server or redeploy.",
    );
    return storageConfigurationError();
  }
  return error;
}

export function configureCloudinary() {
  const credentials = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  };
  if (Object.values(credentials).some((value) => !value)) {
    console.error("Cloudinary cloud name, API key and API secret are required.");
    throw storageConfigurationError();
  }
  cloudinary.config({
    ...credentials,
    secure: true,
  });
  return cloudinary;
}
