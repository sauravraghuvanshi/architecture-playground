import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { readReleaseInfo, parseReleaseInfo } from "../lib/release-info.mjs";
import { sessionCookie } from "./smoke-live-csa.mjs";

export async function verifyRelease({
  baseUrl, expected, username, password, fetchImpl = fetch, wait = delay, attempts = 30,
}) {
  const identity = parseReleaseInfo(expected);
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Release verification requires an HTTPS application origin.");
  }
  if (!username || !password) throw new Error("Release verification credentials are required.");
  const call = (pathname, options = {}) => fetchImpl(`${base.origin}${pathname}`, {
    ...options, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  let login;
  for (let attempt = 0; attempt < attempts; attempt++) {
    login = await call("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
    });
    if (![404, 502, 503].includes(login.status) || attempt + 1 === attempts) break;
    await wait(5000);
  }
  if (!login) throw new Error("Release verification requires a positive attempt budget.");
  if (!login.ok) throw new Error(`Release verification login failed (${login.status}).`);
  const cookie = sessionCookie(login);
  let matching = 0;
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await call("/api/version", { headers: { Cookie: cookie } });
      if (response.ok) {
        const actual = parseReleaseInfo(await response.json());
        matching = actual.revision === identity.revision && actual.buildId === identity.buildId ? matching + 1 : 0;
        if (matching === 3) return actual;
      } else {
        if (![404, 502, 503].includes(response.status)) throw new Error(`Release identity probe failed (${response.status}).`);
        matching = 0;
      }
      if (attempt + 1 < attempts) await wait(5000);
    }
    throw new Error("Expected built release was not observed on three consecutive probes; a healthy older instance does not pass.");
  } finally {
    const logout = await call("/api/auth/logout", { method: "POST", headers: { Cookie: cookie } });
    if (!logout.ok) throw new Error(`Release verification logout failed (${logout.status}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = await verifyRelease({
    baseUrl: process.env.LIVE_BASE_URL, expected: readReleaseInfo(),
    username: process.env.APP_AUTH_USERNAME, password: process.env.APP_AUTH_PASSWORD,
  });
  console.log(`Verified deployed revision ${release.revision}, build ${release.buildId}, on three consecutive no-cache probes.`);
}
