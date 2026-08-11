#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const iconsDir = join(root, "node_modules", "lucide-static", "icons");
const tagsFile = join(root, "node_modules", "lucide-static", "tags.json");
const outFile = join(root, "public", "whiteboard-assets.json");
const targetCount = 600;

const categories = [
  ["People", /(user|person|contact|team|group|message|mail|phone|video|hand|heart|smile|bot)/],
  ["Cloud & systems", /(server|database|cloud|network|router|cable|cpu|container|workflow|git|code|terminal|webhook|binary)/],
  ["Security", /(lock|key|shield|fingerprint|scan|bug|siren|alarm|badge-check|circle-check|triangle-alert)/],
  ["Data & analytics", /(chart|graph|table|file|folder|archive|search|filter|list|rows|columns|sigma|calculator)/],
  ["Business", /(building|briefcase|calendar|clock|target|flag|map|globe|home|store|cart|wallet|credit|receipt)/],
  ["Devices", /(laptop|monitor|smartphone|tablet|printer|keyboard|mouse|headphones|watch|hard-drive|usb)/],
  ["Media", /(image|camera|music|play|pause|mic|volume|film|radio|podcast|gallery|palette|brush)/],
  ["Navigation", /(arrow|chevron|move|corner|route|navigation|compass|milestone|signpost|locate)/],
  ["Shapes & notation", /(circle|square|triangle|diamond|hexagon|octagon|star|pentagon|shapes|brackets|parentheses)/],
  ["Tools & ideas", /(settings|wrench|hammer|screwdriver|tool|lightbulb|rocket|package|box|layers|puzzle|sparkles)/],
];

const preferredByCategory = {
  People: ["user", "users", "contact", "circle-user", "user-round", "handshake", "messages-square", "mail", "phone", "video"],
  "Cloud & systems": ["cloud", "server", "database", "network", "router", "workflow", "cpu", "container", "code", "terminal"],
  Security: ["lock", "key", "shield", "shield-check", "fingerprint", "scan", "bug", "siren", "triangle-alert", "circle-check"],
  "Data & analytics": ["chart-bar", "chart-line", "table", "file", "folder", "archive", "search", "filter", "list", "calculator"],
  Business: ["building", "briefcase", "calendar", "clock", "target", "flag", "map", "globe", "store", "shopping-cart"],
  Devices: ["laptop", "monitor", "smartphone", "tablet", "printer", "keyboard", "mouse", "headphones", "watch", "hard-drive"],
  Media: ["image", "camera", "music", "play", "pause", "mic", "volume-2", "film", "radio", "palette"],
  Navigation: ["arrow-right", "arrow-left", "arrow-up", "arrow-down", "move", "route", "navigation", "compass", "signpost", "locate"],
  "Shapes & notation": ["circle", "square", "triangle", "diamond", "hexagon", "octagon", "star", "shapes", "brackets", "parentheses"],
  "Tools & ideas": ["settings", "wrench", "hammer", "screwdriver", "lightbulb", "rocket", "package", "box", "layers", "puzzle"],
};

function titleCase(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const files = (await readdir(iconsDir))
    .filter((file) => file.endsWith(".svg"))
    .sort();
  const tags = JSON.parse(await readFile(tagsFile, "utf8"));
  const selected = [];
  const used = new Set();

  for (const [category, pattern] of categories) {
    const preferred = preferredByCategory[category] ?? [];
    const matches = [
      ...preferred.filter((name) => files.includes(`${name}.svg`)),
      ...files
      .map((file) => file.replace(/\.svg$/i, ""))
      .filter((name) => pattern.test(`${name} ${(tags[name] ?? []).join(" ")}`))
    ]
      .filter((name, index, values) => values.indexOf(name) === index)
      .filter((name) => !used.has(name))
      .slice(0, 60);
    for (const name of matches) {
      selected.push({ name, category });
      used.add(name);
    }
  }

  for (const file of files) {
    if (selected.length >= targetCount) break;
    const name = file.replace(/\.svg$/i, "");
    if (used.has(name)) continue;
    selected.push({ name, category: "More symbols" });
    used.add(name);
  }

  const assets = await Promise.all(
    selected.slice(0, targetCount).map(async ({ name, category }) => {
      const raw = await readFile(join(iconsDir, `${name}.svg`), "utf8");
      const svg = raw
        .replace(/^<!--[\s\S]*?-->\s*/, "")
        .replaceAll("currentColor", "#0f172a")
        .replace(/\swidth="[^"]*"/, ' width="64"')
        .replace(/\sheight="[^"]*"/, ' height="64"');
      return {
        id: `lucide:${name}`,
        label: titleCase(name),
        category,
        tags: tags[name] ?? [],
        svg,
      };
    })
  );

  await writeFile(
    outFile,
    `${JSON.stringify(
      {
        version: 1,
        count: assets.length,
        license: "ISC",
        source: "https://lucide.dev/",
        generatedAt: new Date().toISOString(),
        assets,
      },
      null,
      2
    )}\n`
  );
  console.log(`✓ Wrote ${assets.length} curated Whiteboard symbols → public/whiteboard-assets.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
