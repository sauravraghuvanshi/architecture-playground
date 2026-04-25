/**
 * RBAC helpers for Organization-scoped permissions.
 *
 * Roles (in increasing privilege):
 *   VIEWER     — read only
 *   COMMENTER  — read + post comments
 *   EDITOR     — read + write diagrams + comment
 *   ADMIN      — all of the above + manage members
 *   OWNER      — admin + delete org / billing
 */
import { getPrisma } from "./prisma";

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

const RANK: Record<Role, number> = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function isRole(s: string | null | undefined): s is Role {
  return !!s && s in RANK;
}

export function meetsRole(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}

export async function getMembership(userId: string, organizationId: string) {
  const prisma = getPrisma();
  return prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
}

export async function requireRole(
  userId: string,
  organizationId: string,
  required: Role
): Promise<{ ok: boolean; role?: Role }> {
  const m = await getMembership(userId, organizationId);
  if (!m || !isRole(m.role)) return { ok: false };
  return { ok: meetsRole(m.role, required), role: m.role };
}
