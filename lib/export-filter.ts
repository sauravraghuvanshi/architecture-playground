const EDITOR_CHROME = [
  "react-flow__minimap",
  "react-flow__controls",
  "react-flow__attribution",
  "react-flow__handle",
  "react-flow__resize-control",
  "react-flow__edge-interaction",
];

export function includeDiagramExportNode(node: HTMLElement | Element): boolean {
  return !(node instanceof Element) || !EDITOR_CHROME.some((name) => node.classList.contains(name));
}
