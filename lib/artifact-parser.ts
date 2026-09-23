import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ArchitectureCodeFormat } from "../components/diagrammatic/csa/architecture-codegen";

export interface ArtifactExpression {
  kind: "string" | "number" | "boolean" | "null" | "reference" | "access" | "index" | "call" | "template" | "array" | "object" | "unsupported";
  text?: string;
  boolean?: boolean;
  items?: ArtifactExpression[];
  entries?: Array<{ key: ArtifactExpression; value: ArtifactExpression }>;
}
export interface ArtifactBody {
  attributes: Array<{ name: string; value: ArtifactExpression }>;
  blocks: ArtifactBlock[];
}
export interface ArtifactBlock {
  type: string;
  labels: string[];
  body: ArtifactBody;
  flags?: string[];
}
export interface ArtifactSyntax {
  parser: string;
  version: string;
  valid: boolean;
  complete: boolean;
  diagnostics: Array<{ code: string; message: string; line: number; column: number }>;
  body?: ArtifactBody;
}

const expressionSchema: z.ZodType<ArtifactExpression> = z.lazy(() => z.object({
  kind: z.enum(["string", "number", "boolean", "null", "reference", "access", "index", "call", "template", "array", "object", "unsupported"]),
  text: z.string().max(120_000).optional(),
  boolean: z.boolean().optional(),
  items: z.array(expressionSchema).max(10_000).optional(),
  entries: z.array(z.object({ key: expressionSchema, value: expressionSchema }).strict()).max(10_000).optional(),
}).strict());
const bodySchema: z.ZodType<ArtifactBody> = z.lazy(() => z.object({
  attributes: z.array(z.object({ name: z.string().max(120_000), value: expressionSchema }).strict()).max(10_000),
  blocks: z.array(blockSchema).max(1000),
}).strict());
const blockSchema: z.ZodType<ArtifactBlock> = z.lazy(() => z.object({
  type: z.string().max(200),
  labels: z.array(z.string().max(120_000)).max(10),
  body: bodySchema,
  flags: z.array(z.string().max(100)).max(20).optional(),
}).strict());
const syntaxSchema: z.ZodType<ArtifactSyntax> = z.object({
  parser: z.string().min(1).max(100),
  version: z.string().min(1).max(100),
  valid: z.boolean(),
  complete: z.boolean(),
  diagnostics: z.array(z.object({
    code: z.string().min(1).max(100),
    message: z.string().max(4000),
    line: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
  }).strict()).max(24),
  body: bodySchema.optional(),
}).strict();

export class ArtifactParserError extends Error {
  readonly code: "unavailable" | "unsupported" | "busy" | "timeout" | "startup-timeout" | "cancelled" | "protocol";
  constructor(code: ArtifactParserError["code"]) {
    super({
      unavailable: "The trusted artifact parser is unavailable. No generated code was executed; validation did not pass.",
      unsupported: "No approved execution-free parser is available for this language/profile. Syntax remains unverified; nothing was executed.",
      busy: "Artifact validation is busy. Retry shortly; no generated code was executed.",
      timeout: "Artifact validation exceeded its safe processing limit. Simplify the draft; no generated code was executed.",
      "startup-timeout": "The trusted validator is taking too long to start. Retry shortly; your draft was not rejected as invalid and no generated code was executed.",
      cancelled: "Artifact validation was cancelled. No generated code was executed.",
      protocol: "The trusted parser returned an invalid response. Validation did not pass.",
    }[code]);
    this.name = "ArtifactParserError";
    this.code = code;
  }
}

function validatorRoot(): string {
  const configured = process.env.DIAGRAMMATIC_VALIDATOR_ROOT?.trim();
  if (configured) return path.resolve(configured);
  const deployed = path.join(process.cwd(), "artifact-validation");
  return existsSync(deployed) ? deployed : path.join(process.cwd(), "node_modules", ".cache", "artifact-validation");
}

function parserEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_EnableDiagnostics: "0",
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1",
    DOTNET_GCHeapHardLimit: "8000000",
    DOTNET_DbgEnableMiniDump: "0",
    GOMEMLIMIT: "128MiB",
    GOTRACEBACK: "none",
    LANG: "C",
    LC_ALL: "C",
  };
  if (process.platform === "win32") {
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    if (process.env.WINDIR) env.WINDIR = process.env.WINDIR;
  }
  return env;
}

let activeParsers = 0;
const MAX_PARSERS = 2;
const MAX_OUTPUT_BYTES = 2_000_000;
const PARSER_TIMEOUT_MS = 5000;
const PARSER_STARTUP_TIMEOUT_MS = 15000;
const PARSER_READY = Buffer.from("DIAGRAMMATIC_PARSER_READY_V1\n");

async function invokeParser(executable: string, input: string, signal?: AbortSignal, args: string[] = []): Promise<{ stdout: string; stderr: string; code: number | null }> {
  if (signal?.aborted) throw new ArtifactParserError("cancelled");
  if (activeParsers >= MAX_PARSERS) throw new ArtifactParserError("busy");
  if (!existsSync(executable)) throw new ArtifactParserError("unavailable");
  activeParsers++;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        shell: false, windowsHide: true, cwd: path.dirname(executable),
        env: parserEnvironment(), stdio: ["pipe", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      const errors: Buffer[] = [];
      let bytes = 0;
      let done = false;
      let pendingError: ArtifactParserError | undefined;
      let ready = !args.includes("--ready");
      let greeting = Buffer.alloc(0);
      const finish = (error?: ArtifactParserError, code: number | null = null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
        if (error) reject(error); else resolve({ stdout: Buffer.concat(chunks).toString("utf8"), stderr: Buffer.concat(errors).toString("utf8"), code });
      };
      const stop = (error: ArtifactParserError) => {
        if (done || pendingError) return;
        pendingError = error;
        child.kill("SIGKILL");
      };
      const cancel = () => stop(new ArtifactParserError("cancelled"));
      let timer = setTimeout(() => stop(new ArtifactParserError(ready ? "timeout" : "startup-timeout")), ready ? PARSER_TIMEOUT_MS : PARSER_STARTUP_TIMEOUT_MS);
      signal?.addEventListener("abort", cancel, { once: true });
      child.on("error", () => finish(new ArtifactParserError("unavailable")));
      child.stdin.on("error", () => stop(new ArtifactParserError("protocol")));
      child.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) { stop(new ArtifactParserError("protocol")); return; }
        if (!ready) {
          greeting = Buffer.concat([greeting, chunk]);
          const newline = greeting.indexOf(10);
          if (newline === -1) {
            if (greeting.length > PARSER_READY.length + 1) stop(new ArtifactParserError("protocol"));
            return;
          }
          const received = greeting.subarray(0, newline + 1).toString("utf8").replace(/\r\n$/, "\n");
          if (received !== PARSER_READY.toString("utf8") || pendingError) { stop(new ArtifactParserError("protocol")); return; }
          ready = true;
          clearTimeout(timer);
          timer = setTimeout(() => stop(new ArtifactParserError("timeout")), PARSER_TIMEOUT_MS);
          const rest = greeting.subarray(newline + 1);
          if (rest.length) chunks.push(rest);
          greeting = Buffer.alloc(0);
          child.stdin.end(input);
        } else chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) stop(new ArtifactParserError("protocol"));
        else errors.push(chunk);
      });
      child.on("close", (code) => {
        if (pendingError) finish(pendingError);
        else if (!ready) finish(new ArtifactParserError("protocol"));
        else finish(undefined, code);
      });
      if (ready) child.stdin.end(input);
      if (signal?.aborted) cancel();
    });
  } finally {
    activeParsers--;
  }
}

export async function parseArtifactSyntax(
  code: string,
  format: ArchitectureCodeFormat,
  signal?: AbortSignal,
): Promise<ArtifactSyntax> {
  if (code.length > 120_000 || Buffer.byteLength(code, "utf8") > 480_000) throw new ArtifactParserError("protocol");
  if (signal?.aborted) throw new ArtifactParserError("cancelled");
  if (format === "powershell") throw new ArtifactParserError("unsupported");
  if (format === "azure-cli") {
    const executable = process.env.BASH_CLI?.trim() || (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "/bin/bash");
    const versionResult = await invokeParser(executable, "", signal, ["--version"]);
    const version = /GNU bash, version (\d+\.\d+(?:\.\d+)?)/.exec(versionResult.stdout)?.[1];
    if (versionResult.code !== 0 || !version || Number(version.split(".")[0]) < 5) throw new ArtifactParserError("unsupported");
    const result = await invokeParser(executable, code, signal, ["--noprofile", "--norc", "-n", "-s", "--"]);
    if (result.code !== 0 && result.code !== 2) throw new ArtifactParserError("protocol");
    const valid = result.code === 0 && !result.stderr.trim();
    return {
      parser: "gnu-bash-noexec", version, valid, complete: false,
      diagnostics: valid ? [] : [{
        code: "bash_syntax",
        message: "GNU Bash reported a syntax error or warning; the script was not executed.",
        line: Number(/line (\d+)/.exec(result.stderr)?.[1] ?? 0), column: 0,
      }],
    };
  }
  const suffix = process.platform === "win32" ? ".exe" : "";
  const root = validatorRoot();
  const executable = format === "terraform"
    ? path.join(root, `hcl-parser${suffix}`)
    : path.join(root, "dotnet", `Diagrammatic.ArtifactParser${suffix}`);
  const request = format === "terraform" ? { code } : { language: format, code };
  const output = await invokeParser(executable, JSON.stringify(request), signal, format === "bicep" ? ["--ready"] : []);
  if (output.code !== 0 || output.stderr.trim()) throw new ArtifactParserError("protocol");
  try {
    return syntaxSchema.parse(JSON.parse(output.stdout));
  } catch {
    throw new ArtifactParserError("protocol");
  }
}
