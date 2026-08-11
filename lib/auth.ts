export const SESSION_COOKIE = "diagrammatic_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

interface AuthConfig {
  username: string;
  password: string;
  secret: string;
}

interface SessionPayload {
  username: string;
  expiresAt: number;
}

export function authEnabled(): boolean {
  return process.env.APP_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function getAuthConfig(): AuthConfig | null {
  if (!authEnabled()) return null;
  const username = readAuthSetting("APP_AUTH_USERNAME")?.trim();
  const password = readAuthSetting("APP_AUTH_PASSWORD");
  const secret = readAuthSetting("APP_AUTH_SECRET");
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

function readAuthSetting(name: string): string | undefined {
  const encoded = process.env[`${name}_B64`];
  if (!encoded) return process.env[name];
  try {
    return new TextDecoder().decode(base64UrlDecode(encoded));
  } catch {
    return undefined;
  }
}

export function timingSafeTextEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(username: string): Promise<string> {
  const config = getAuthConfig();
  if (!config) throw new Error("Authentication is not configured");
  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return `${encodedPayload}.${await sign(encodedPayload, config.secret)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  const config = getAuthConfig();
  if (!config || !token) return false;
  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return false;
  const expectedSignature = await sign(encodedPayload, config.secret);
  if (!timingSafeTextEqual(providedSignature, expectedSignature)) return false;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as SessionPayload;
    return (
      timingSafeTextEqual(payload.username, config.username) &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
