/**
 * API key helpers — generation, hashing, validation for /api/v1/* endpoints.
 *
 * Wire format: `ap_live_<24-char-base32>`. We store SHA-256(plaintext) and
 * the visible prefix only. The plaintext is shown to the user once at create
 * time and never persisted.
 */
import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "./prisma";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // base32 minus look-alikes
const PREFIX = "ap_live_";

function randomToken(len = 24): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const tail = randomToken(24);
  const plaintext = `${PREFIX}${tail}`;
  const prefix = plaintext.slice(0, 12);
  const hash = sha256(plaintext);
  return { plaintext, prefix, hash };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export interface ResolvedApiKey {
  userId: string;
  organizationId: string | null;
  scopes: string[];
  apiKeyId: string;
}

/**
 * Validate an Authorization: Bearer ap_live_xxx token. Returns the owning
 * user/org or null if invalid/expired/revoked. Updates lastUsedAt.
 */
export async function authenticateApiKey(authorizationHeader: string | null): Promise<ResolvedApiKey | null> {
  if (!authorizationHeader) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
  if (!m) return null;
  const token = m[1];
  if (!token.startsWith(PREFIX)) return null;
  const hash = sha256(token);
  const prisma = getPrisma();
  const key = await prisma.apiKey.findUnique({ where: { hashedKey: hash } });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;
  // Best-effort lastUsedAt bump
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  return {
    userId: key.userId,
    organizationId: key.organizationId,
    scopes: (key.scopes || "read,write").split(",").map((s: string) => s.trim()).filter(Boolean),
    apiKeyId: key.id,
  };
}

export function requireScope(resolved: ResolvedApiKey, scope: "read" | "write"): boolean {
  return resolved.scopes.includes(scope);
}
