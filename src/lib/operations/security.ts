import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { getSession } from "@/lib/auth";
import { permitted, type Permission } from "./policy";
export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function requireCondition(
  condition: unknown,
  message: string,
  status = 422,
): asserts condition {
  if (!condition) throw new WorkflowError(message, status);
}
export async function requireUser(permission?: Permission) {
  const user = await getSession();
  requireCondition(user, "Sign in to continue", 401);
  if (permission)
    requireCondition(
      permitted(user.role, permission),
      "You do not have permission for this action",
      403,
    );
  return user;
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function encryptIdentity(value: string) {
  const secret = process.env.DRIVER_DATA_KEY;
  requireCondition(
    secret && /^[a-f\d]{64}$/i.test(secret),
    "Driver document encryption is not configured",
    503,
  );
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(secret, "hex"),
    nonce,
  );
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${nonce.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${payload.toString("hex")}`;
}
export function decryptIdentity(value: string) {
  const secret = process.env.DRIVER_DATA_KEY;
  requireCondition(
    secret && /^[a-f\d]{64}$/i.test(secret),
    "Driver document encryption is not configured",
    503,
  );
  const [nonce, tag, payload] = value.split(":");
  requireCondition(
    nonce && tag && payload,
    "Encrypted identity data is unavailable",
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(secret, "hex"),
    Buffer.from(nonce, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
