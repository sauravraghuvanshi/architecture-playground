export const releaseBrowserSuites = [
  {
    projects: ["chromium"],
    files: [
      "screenshot-regressions.spec.ts", "architecture-roundtrip.spec.ts",
      "architecture-model.spec.ts", "architecture-boundaries.spec.ts", "undo-redo.spec.ts",
      "persistence-recovery.spec.ts", "diagram-library.spec.ts", "whiteboard-restoration.spec.ts",
      "whiteboard-conversion.spec.ts", "whiteboard-fidelity.spec.ts",
      "ai-streaming.spec.ts", "ai-readiness.spec.ts", "ai-privacy.spec.ts",
      "review-contracts.spec.ts", "engineering-validation.spec.ts", "deployment-assistance.spec.ts",
      "csa-guidance.spec.ts",
    ],
  },
  {
    projects: ["firefox", "webkit"],
    files: ["screenshot-regressions.spec.ts", "browser-core.spec.ts", "review-contracts.spec.ts", "csa-guidance.spec.ts"],
  },
];
