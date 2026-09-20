import { createReadStream } from "node:fs";
import { pathToFileURL } from "node:url";

export async function deployZip({
  endpoint, username, password, zipPath = "deploy.zip", fetchImpl = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now, timeoutMs = 15 * 60_000, uploadBody,
}) {
  const base = new URL(endpoint);
  if (base.protocol !== "https:" || base.username || base.password ||
      !base.hostname.endsWith(".scm.azurewebsites.net") || base.pathname !== "/api/zipdeploy") {
    throw new Error("A trusted App Service HTTPS zipdeploy endpoint is required.");
  }
  if (!username || !password) throw new Error("Deployment credentials are required.");
  base.searchParams.set("isAsync", "true");
  const headers = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
  const response = await fetchImpl(base, {
    method: "POST", redirect: "manual", headers: { ...headers, "Content-Type": "application/zip" },
    body: uploadBody ?? createReadStream(zipPath), duplex: "half", signal: AbortSignal.timeout(5 * 60_000),
  });
  if (![200, 202].includes(response.status)) throw new Error(`ZIP deployment upload failed (${response.status}).`);
  const location = response.headers.get("location");
  if (!location) throw new Error("Async deployment did not return an operation status URL.");
  const statusUrl = new URL(location, base);
  if (statusUrl.origin !== base.origin || statusUrl.username || statusUrl.password || !/^\/api\/deployments\/[A-Za-z0-9_-]+$/.test(statusUrl.pathname)) {
    throw new Error("Deployment status URL is outside the trusted SCM operation path.");
  }
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const result = await fetchImpl(statusUrl, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (result.status === 202) { await wait(5000); continue; }
    if (!result.ok) throw new Error(`Deployment status lookup failed (${result.status}).`);
    const status = await result.json();
    if (status.status === 4 && status.complete !== false) return { id: status.id, status: "completed" };
    if (status.status === 3) throw new Error("SCM reported deployment failure. Inspect the deployment logs.");
    if (![0, 1, 2, 4].includes(status.status)) throw new Error("SCM returned an unknown deployment state.");
    await wait(5000);
  }
  throw new Error("Async deployment did not finish within the bounded wait. Verification has not passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await deployZip({
    endpoint: "https://architecture-playground.scm.azurewebsites.net/api/zipdeploy",
    username: process.env.DEPLOY_USER, password: process.env.DEPLOY_PASS,
  });
  console.log(`SCM deployment ${result.id ?? "operation"} completed before application verification.`);
}
