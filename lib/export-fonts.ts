const FONT_BYTE_LIMIT = 2 * 1024 * 1024;
const FONT_TOTAL_LIMIT = 16 * 1024 * 1024;

function familyName(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, "$2").toLowerCase();
}

function isFontRule(rule: CSSRule): rule is CSSFontFaceRule {
  return rule.type === CSSRule.FONT_FACE_RULE;
}

function isImportRule(rule: CSSRule): rule is CSSImportRule {
  return rule.type === CSSRule.IMPORT_RULE;
}

function nestedRules(rule: CSSRule): rule is CSSRule & { cssRules: CSSRuleList } {
  return "cssRules" in rule;
}

async function fontDataUrl(url: string, recordBytes: (size: number) => void): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "same-origin", referrerPolicy: "no-referrer", cache: "force-cache" });
    if (!response.ok || Number(response.headers.get("content-length")) > FONT_BYTE_LIMIT) {
      if (response.body) void response.body.cancel().catch(() => {});
      throw new Error(!response.ok ? `Export font could not be loaded (HTTP ${response.status}).` : "Export font exceeds the 2 MiB limit.");
    }
    if (!response.body) throw new Error("Export font response has no body.");
    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    let complete = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > FONT_BYTE_LIMIT) throw new Error("Export font exceeds the 2 MiB limit.");
        recordBytes(value.byteLength);
        const copy = new Uint8Array(value.byteLength);
        copy.set(value);
        chunks.push(copy.buffer);
      }
      complete = true;
    } finally {
      if (!complete) void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!size) throw new Error("Export font response is empty.");
    const blob = new Blob(chunks, { type: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream" });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Export font could not be encoded."));
      reader.onerror = () => reject(new Error("Export font could not be encoded."));
      reader.readAsDataURL(blob);
    });
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("Export font loading timed out. Retry when the font resource is available.");
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

/** Supply html-to-image's public fontEmbedCSS option without relying on
 * CSSFontFaceDescriptors camel-case properties, which differ across browsers. */
export async function getExportFontCss(root: HTMLElement): Promise<string> {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error("The export surface has no active document.");
  const used = new Set<string>();
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const families = view.getComputedStyle(element).getPropertyValue("font-family");
    for (const match of families.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,]+/g)) used.add(familyName(match[0]));
  }
  const faces: CSSFontFaceRule[] = [];
  const visited = new Set<CSSStyleSheet>();
  function collectRules(rules: CSSRuleList, depth: number) {
    if (depth > 32) throw new Error("Export stylesheet nesting exceeds the supported limit.");
    for (const rule of Array.from(rules)) {
      if (isFontRule(rule)) {
        if (used.has(familyName(rule.style.getPropertyValue("font-family")))) faces.push(rule);
      } else if (isImportRule(rule) && rule.styleSheet) collectSheet(rule.styleSheet, depth + 1);
      else if (nestedRules(rule)) collectRules(rule.cssRules, depth + 1);
    }
  }
  function collectSheet(sheet: CSSStyleSheet, depth: number) {
    if (visited.has(sheet)) return;
    visited.add(sheet);
    try { collectRules(sheet.cssRules, depth); }
    catch (cause) {
      if (cause instanceof DOMException && cause.name === "SecurityError") {
        throw new Error("An export stylesheet cannot be read. Serve fonts and styles with appropriate same-origin/CORS access.");
      }
      throw cause;
    }
  }
  for (const sheet of Array.from(document.styleSheets)) collectSheet(sheet, 0);

  let bytes = 0;
  const resources = new Map<string, Promise<string>>();
  const css: string[] = [];
  for (const face of faces) {
    let rule = face.cssText;
    const source = face.style.getPropertyValue("src");
    for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g)) {
      const value = (match[1] ?? match[2] ?? match[3]).trim();
      if (value.startsWith("data:")) continue;
      const url = new URL(value, face.parentStyleSheet?.href || document.baseURI);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Export font uses an unsupported resource protocol.");
      let resource = resources.get(url.href);
      if (!resource) {
        resource = fontDataUrl(url.href, (size) => {
          bytes += size;
          if (bytes > FONT_TOTAL_LIMIT) throw new Error("Export fonts exceed the 16 MiB combined limit.");
        });
        resources.set(url.href, resource);
      }
      rule = rule.replaceAll(match[0], `url("${await resource}")`);
    }
    css.push(rule);
  }
  return css.join("\n");
}
