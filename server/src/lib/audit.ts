import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function logAudit(params: {
  actorId: string;
  action: string;
  claimId?: string;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      claimId: params.claimId,
      details: params.details as Prisma.InputJsonValue | undefined,
    },
  });
}
