import { beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getSession: session }));
import { GET as queue } from "@/app/api/operations/route";
import { GET as application } from "@/app/api/driver/application/route";
import { PATCH as legacyCrew } from "@/app/api/crew/jobs/[id]/route";
import { GET as drivers } from "@/app/api/admin/drivers/[id]/route";
beforeEach(() => session.mockReset());
describe("server-side workspace isolation", () => {
  it("rejects signed-out access before any database query", async () => {
    session.mockResolvedValue(null);
    expect(
      (await queue(new Request("https://example.test/api/operations"))).status,
    ).toBe(401);
  });
  it("blocks customer/driver access to staff queues", async () => {
    for (const role of ["customer", "driver"]) {
      session.mockResolvedValue({ id: "a".repeat(24), role });
      expect(
        (
          await queue(
            new Request("https://example.test/api/operations?view=drivers"),
          )
        ).status,
      ).toBe(403);
    }
  });
  it("prevents finance from viewing identity documents", async () => {
    session.mockResolvedValue({ id: "a".repeat(24), role: "finance" });
    expect(
      (
        await drivers(new Request("https://example.test"), {
          params: Promise.resolve({ id: "b".repeat(24) }),
        })
      ).status,
    ).toBe(403);
  });
  it("keeps customer accounts out of driver applications", async () => {
    session.mockResolvedValue({ id: "a".repeat(24), role: "customer" });
    expect((await application()).status).toBe(403);
  });
  it("disables legacy driver self-verification", async () => {
    expect((await legacyCrew()).status).toBe(410);
  });
});
