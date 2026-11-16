import { RateLimit } from "./models";
import { hashToken, requireCondition } from "./security";
export async function rateLimit(
  req: Request,
  action: string,
  limit: number,
  windowSeconds = 3600,
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unavailable";
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = hashToken(
    `${process.env.SESSION_SECRET ?? "wwp"}:${action}:${ip}:${bucket}`,
  );
  const row = await RateLimit.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        expiresAt: new Date((bucket + 1) * windowSeconds * 1000),
      },
    },
    { upsert: true, new: true },
  );
  requireCondition(
    row.count <= limit,
    "Too many requests. Please try again later.",
    429,
  );
}
