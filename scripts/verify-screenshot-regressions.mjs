import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = "3323";
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, APP_AUTH_ENABLED: "false", PORT: port, HOSTNAME: "127.0.0.1",
  PLAYWRIGHT_SKIP_WEBSERVER: "true", PLAYWRIGHT_BASE_URL: baseUrl, PLAYWRIGHT_CROSS_BROWSER: "false",
  DIAGRAMMATIC_AI_PROXY_URL: "disabled",
};
delete env.PLAYWRIGHT_STORAGE_STATE;
for (const key of Object.keys(env)) if (key.startsWith("AZURE_")) delete env[key];
const server = spawn(process.execPath, [".next/standalone/server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
let launchError;
server.on("error", (error) => { launchError = error; });
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-8_000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`Regression server exited (${server.exitCode}).\n${logs}`);
    try {
      const response = await fetch(`${baseUrl}/api/ai/status`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch (cause) {
      if (!(cause instanceof Error)) throw cause;
      // Startup connections may precede the listening socket; bounded retry only.
    }
    await delay(500);
  }
  if (!ready) throw new Error(`Regression server did not become ready.\n${logs}`);
  const result = await new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, [
      "node_modules/@playwright/test/cli.js", "test", "screenshot-regressions.spec.ts",
      "--project=chromium", "--workers=1", "--reporter=line",
    ], { env, stdio: "inherit" });
    tests.once("error", reject);
    tests.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  if (result !== 0) throw new Error(`Screenshot regression gate failed (${result}); deployment is blocked.`);
} finally {
  if (server.exitCode === null && !server.killed) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(5000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}
