import crypto from "node:crypto";

export const sha256 = (input) => crypto.createHash("sha256").update(input).digest("hex");
export const randomId = () => crypto.randomUUID();
export function createInvitationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const group = () => Array.from(crypto.randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join("");
  return `APAI-${group()}-${group()}`;
}
export const normalizeInvitation = (value) => String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().replace(/^APAI/, "APAI").replace(/^(APAI)(.{4})(.{4})$/, "$1-$2-$3");
