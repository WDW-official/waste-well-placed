import { cookies } from "next/headers";
import type { ClientSession } from "mongoose";
import { UploadAsset } from "./models";
import { hashToken, newToken, requireCondition } from "./security";
export async function guestIdentity(create = false) {
  const jar = await cookies();
  let value = jar.get("wwp_upload_guest")?.value;
  if (!value && create) {
    value = newToken();
    jar.set("wwp_upload_guest", value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 86400,
      path: "/",
    });
  }
  return value ? hashToken(value) : undefined;
}
export async function ownAssets(
  ids: string[],
  ownerId: string | undefined,
  purpose: string,
  session?: ClientSession,
) {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const guestId = await guestIdentity();
  const identity = [
    ...(ownerId ? [{ ownerId }] : []),
    ...(guestId ? [{ guestId }] : []),
  ];
  requireCondition(identity.length, "Upload session has expired", 403);
  const count = await UploadAsset.countDocuments({
    _id: { $in: unique },
    purpose,
    deletedAt: { $exists: false },
    $or: identity,
  }).session(session ?? null);
  requireCondition(
    count === unique.length,
    "One or more uploaded files are unavailable or belong to another user",
    403,
  );
}
export async function attachPhotos(
  photos: { publicId: string; secureUrl: string }[],
  ownerId: string | undefined,
  link: { bookingId?: string; quoteId?: string },
  session?: ClientSession,
) {
  const ids = photos.map(
    (photo) => photo.secureUrl.match(/^\/api\/assets\/([a-f\d]{24})$/i)?.[1],
  );
  requireCondition(
    ids.every(Boolean),
    "Please re-upload photos using the private uploader",
  );
  await ownAssets(ids as string[], ownerId, "quote", session);
  for (let index = 0; index < ids.length; index++) {
    const changed = await UploadAsset.updateOne(
      {
        _id: ids[index],
        publicId: photos[index].publicId,
        quoteId: { $exists: false },
        ...(link.bookingId ? { bookingId: { $exists: false } } : {}),
      },
      { $set: link },
      { session },
    );
    requireCondition(
      changed.matchedCount,
      "Photo has already been attached to another request",
    );
  }
}
