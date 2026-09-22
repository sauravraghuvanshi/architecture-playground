import { setTimeout as delay } from "node:timers/promises";

export async function hostedValidationRequest(call, body, cookie, {
  attempts = 12, wait = delay, report = console.warn,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await call("/api/deploy/validate", body, cookie);
    if (response.ok) return response.json();
    const transient = [404, 502, 503].includes(response.status);
    const result = await response.json().catch(() => null);
    const code = typeof result?.code === "string" && /^[a-z_-]{1,32}$/.test(result.code) ? result.code : "unspecified";
    const message = `Hosted ${body.artifact.format} static validation: HTTP ${response.status}, code ${code}, attempt ${attempt}/${attempts}.`;
    if (!transient || attempt === attempts) throw new Error(message);
    report(`${message} Waiting for the validator; this is not a validation pass.`);
    await wait(5000);
  }
  throw new Error("Hosted validation requires at least one attempt.");
}
