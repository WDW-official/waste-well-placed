import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

const actor = vi.hoisted(() => ({ role: "admin" }));
const provider = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    id: "507f1f77bcf86cd799439011",
    role: actor.role,
  }),
}));
vi.mock("@/lib/cloudinary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cloudinary")>()),
  configureCloudinary: () => ({ uploader: { upload_stream: provider.upload } }),
}));
import { POST } from "@/app/api/admin/images/route";
import { connectDB } from "@/lib/db";
import { Audit } from "@/lib/models";
import { RateLimit } from "@/lib/operations/models";

let replica: MongoMemoryReplSet;
const imageUrl =
  "https://res.cloudinary.com/example/image/upload/admin-test.png";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V8AAAAASUVORK5CYII=",
  "base64",
);

function uploadRequest(bytes: Uint8Array = png, type = "image/png") {
  const body = new FormData();
  body.set(
    "file",
    new File([new Uint8Array(bytes).buffer], "example.png", { type }),
  );
  return new Request("https://example.test/api/admin/images", {
    method: "POST",
    headers: { origin: "https://example.test" },
    body,
  });
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replica.getUri("wwp_admin_images_test");
  await connectDB();
});
afterAll(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
  delete process.env.MONGODB_URI;
});
beforeEach(async () => {
  actor.role = "admin";
  provider.upload.mockReset();
  await Audit.deleteMany({});
  await RateLimit.deleteMany({});
});

describe("admin record image uploads", () => {
  it("uploads public content images with server-controlled parameters and an audit record", async () => {
    provider.upload.mockImplementation((_options, callback) => ({
      end: (bytes: Buffer) => {
        expect(bytes.equals(png)).toBe(true);
        callback(null, {
          secure_url: imageUrl,
          public_id: "waste-well-placed/content/test-image",
        });
      },
    }));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ secureUrl: imageUrl });
    expect(provider.upload.mock.calls[0][0]).toMatchObject({
      resource_type: "image",
      type: "upload",
      overwrite: false,
    });
    expect(provider.upload.mock.calls[0][0].public_id).toMatch(
      /^waste-well-placed\/content\//,
    );
    expect(
      await Audit.exists({ action: "content.image_uploaded" }),
    ).toBeTruthy();
  });

  it("does not upload files from non-admins or files with mismatched content", async () => {
    actor.role = "customer";
    expect((await POST(uploadRequest())).status).toBe(403);
    actor.role = "admin";
    expect(
      (await POST(uploadRequest(Buffer.from("not an image")))).status,
    ).toBe(422);
    expect((await POST(uploadRequest(png, "image/jpeg"))).status).toBe(422);
    expect((await POST(uploadRequest(Buffer.alloc(3_000_001)))).status).toBe(
      422,
    );
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it("returns a useful service error for rejected Cloudinary credentials", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    provider.upload.mockImplementation((_options, callback) => ({
      end: () => callback({ http_code: 401, message: "Invalid signature" }),
    }));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is unavailable. Please contact support.",
    });
    log.mockRestore();
  });
});
