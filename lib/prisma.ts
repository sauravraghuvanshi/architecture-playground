/**
 * Prisma client singleton for the Architecture Playground.
 * Only call getPrisma() at RUNTIME inside request handlers — never at module top level.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function getPrisma() {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@/app/generated/prisma/client");
    const g = globalThis as unknown as { __prisma: unknown };
    _prisma = g.__prisma || new PrismaClient({});
    if (process.env.NODE_ENV !== "production") g.__prisma = _prisma;
  }
  return _prisma;
}
