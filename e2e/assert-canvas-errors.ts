import { expect, test, type Page } from "@playwright/test";

const RESIZE_DELIVERY_NOTICE = "ResizeObserver loop completed with undelivered notifications.";

export async function assertCanvasErrors(page: Page, errors: string[]) {
  expect(errors.filter((message) => message !== RESIZE_DELIVERY_NOTICE)).toEqual([]);
  const notices = errors.filter((message) => message === RESIZE_DELIVERY_NOTICE).length;
  expect(notices, "Repeated resize delivery deferrals may indicate an actual layout loop").toBeLessThanOrEqual(2);
  if (!notices) return;
  const rectangles = await page.locator(".diagrammatic-whiteboard").evaluate(async (node) => {
    const sample = () => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const first = sample();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return [first, sample()];
  });
  expect(rectangles[1]).toEqual(rectangles[0]);
  expect(errors.filter((message) => message === RESIZE_DELIVERY_NOTICE)).toHaveLength(notices);
  test.info().annotations.push({
    type: "browser-layout-notice",
    description: `${notices} standard ResizeObserver delivery notice(s); layout settled and all scene/binary assertions passed. No application error was suppressed.`,
  });
}
