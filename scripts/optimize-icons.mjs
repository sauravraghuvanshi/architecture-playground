/**
 * optimize-icons.mjs — Clean up V-4.5 Visio-exported SVGs using SVGO.
 *
 * Removes:
 *   - Inkscape/Sodipodi/Visio metadata and namespaces
 *   - XML processing instructions
 *   - Empty groups, unused defs, comments
 *   - Redundant attributes
 *
 * Preserves:
 *   - Visual content (paths, shapes, text)
 *   - viewBox
 *   - Fill/stroke colors
 *
 * Run: node scripts/optimize-icons.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "public", "cloud-icons");

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          // Keep viewBox — critical for scaling
          removeViewBox: false,
        },
      },
    },
    // Do NOT removeXMLNS — xmlns is required for <img> tag rendering
    "removeXMLProcInst",
    "removeComments",
    "removeMetadata",
    "removeEditorsNSData",
    "removeEmptyContainers",
    {
      name: "removeAttrs",
      params: {
        attrs: [
          "sodipodi:*",
          "inkscape:*",
          "xml:space",
          "class",
        ],
      },
    },
    // Remove fill:none from root SVG style (causes invisible shapes)
    {
      name: "removeFillNoneFromRoot",
      fn: () => ({
        element: {
          enter: (node) => {
            if (node.name === "svg" && node.attributes.style) {
              node.attributes.style = node.attributes.style
                .replace(/fill\s*:\s*none\s*;?/g, "")
                .replace(/^\s*;\s*/, "")
                .replace(/;\s*$/, "");
              if (!node.attributes.style.trim()) {
                delete node.attributes.style;
              }
            }
          },
        },
      }),
    },
  ],
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.name.endsWith(".svg")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await walk(ICONS_DIR);
  let optimized = 0;
  let totalSaved = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      const original = await readFile(filePath, "utf8");
      const originalSize = Buffer.byteLength(original, "utf8");

      // Skip tiny/already-clean files
      if (originalSize < 200) continue;

      const result = optimize(original, {
        ...svgoConfig,
        path: filePath,
      });

      const newSize = Buffer.byteLength(result.data, "utf8");
      const saved = originalSize - newSize;

      if (saved > 0) {
        await writeFile(filePath, result.data);
        totalSaved += saved;
        optimized++;
      }
    } catch (err) {
      console.warn(`⚠  Error optimizing ${filePath}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ SVGO optimization complete`);
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files optimized: ${optimized}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total saved: ${(totalSaved / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
