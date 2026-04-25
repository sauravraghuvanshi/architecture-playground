/**
 * Prisma client singleton for the Architecture Playground.
 * Lazy-loaded to avoid build-time database connection errors.
 * Re-uses a single PrismaClient instance across hot-reloads in development.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export function getPrisma() {
  if (!_prisma) {
    // Dynamic require to avoid build-time evaluation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require("@/app/generated/prisma/client");
    const globalForPrisma = globalThis as unknown as { __prisma: unknown };
    _prisma = globalForPrisma.__prisma || new PrismaClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = _prisma;
  }
  return _prisma;
}

// For convenience — lazy proxy
export const prisma = new Proxy({} as ReturnType<typeof getPrisma>, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});
