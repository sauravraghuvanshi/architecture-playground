/**
 * /diagrammatic — the new workspace landing.
 *
 * Server component: loads the icon manifest from disk and hands it to the
 * client-only Workspace. No diagram id → starts as an anonymous draft kept
 * in localStorage; saving to Postgres requires picking/creating a diagram
 * (handled in R3 once we wire the dashboard flow into the new mode column).
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Workspace } from "@/components/diagrammatic/Workspace";
import type { IconLite } from "@/components/diagrammatic/shared/types";

export const metadata: Metadata = {
  title: "Diagrammatic — multi-mode diagram workspace",
  description:
    "Cloud architecture, flowcharts, mind maps, ER, UML, sequence diagrams, whiteboarding, and Kanban — one workspace, AI-assisted, with animated request-flow GIFs.",
};

interface RawIcon {
  id: string;
  cloud: string;
  cloudLabel: string;
  category: string;
  categoryLabel: string;
  label: string;
  path: string;
}

interface RawManifest {
  icons: RawIcon[];
}

async function loadIcons(): Promise<IconLite[]> {
  const file = path.join(process.cwd(), "content", "cloud-icons.json");
  const raw = await fs.readFile(file, "utf8");
  const m = JSON.parse(raw) as RawManifest;
  return m.icons.map((i) => ({
    id: i.id,
    cloud: i.cloud,
    cloudLabel: i.cloudLabel,
    category: i.category,
    categoryLabel: i.categoryLabel,
    label: i.label,
    path: i.path,
  }));
}

export default async function DiagrammaticPage() {
  const icons = await loadIcons();
  return <Workspace icons={icons} />;
}
