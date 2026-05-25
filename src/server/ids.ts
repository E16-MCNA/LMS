import crypto from "crypto";

export function generateId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}
