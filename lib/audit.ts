/**
 * Audit logging helper. Best-effort: failures here MUST NOT break the
 * underlying operation, so we swallow errors and log to console.
 */
import { getPrisma } from "./prisma";

export interface AuditEvent {
  action: string;                       // e.g. "diagram.create"
  userId?: string | null;
  organizationId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        action: event.action,
        userId: event.userId ?? null,
        organizationId: event.organizationId ?? null,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      },
    });
  } catch (err) {
    console.warn("[audit] failed to record:", err);
  }
}

/** Extract IP + UA headers from a Request. */
export function auditContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress, userAgent };
}
