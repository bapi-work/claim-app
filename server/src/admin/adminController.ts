import { Router } from "express";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";
import { requireAuth, requireRole, AuthedRequest } from "../auth/authMiddleware";
import { toCsv } from "./export";
import { convert } from "../lib/currency";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("FINANCE", "HR", "ADMIN"));

// All claims with optional filters: status, department, from/to date.
adminRouter.get("/claims", async (req, res) => {
  const { status, department, from, to } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (department) where.submitter = { department };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const claims = await prisma.claim.findMany({
    where,
    include: {
      submitter: { select: { id: true, name: true, email: true, department: true, homeCurrency: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    claims.map((c) => ({
      ...c,
      homeCurrencyAmount: convert(Number(c.amount), c.currency, c.submitter.homeCurrency),
    }))
  );
});

adminRouter.get("/claims/export.csv", async (req: AuthedRequest, res) => {
  const claims = await prisma.claim.findMany({
    include: { submitter: { select: { name: true, email: true, department: true, homeCurrency: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = claims.map((c) => ({
    id: c.id,
    submitter: c.submitter.name,
    email: c.submitter.email,
    department: c.submitter.department ?? "",
    type: c.type,
    title: c.title,
    amount: c.amount.toString(),
    currency: c.currency,
    homeCurrency: c.submitter.homeCurrency,
    homeCurrencyAmount: convert(Number(c.amount), c.currency, c.submitter.homeCurrency),
    status: c.status,
    submittedAt: c.submittedAt ? c.submittedAt.toISOString() : "",
    createdAt: c.createdAt.toISOString(),
  }));

  const csv = toCsv(rows, [
    "id",
    "submitter",
    "email",
    "department",
    "type",
    "title",
    "amount",
    "currency",
    "homeCurrency",
    "homeCurrencyAmount",
    "status",
    "submittedAt",
    "createdAt",
  ]);

  await logAudit({ actorId: req.user!.id, action: "CLAIMS_EXPORTED", details: { count: claims.length } });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=claims-export.csv");
  res.send(csv);
});

adminRouter.get("/audit-log", async (req, res) => {
  const { claimId } = req.query as Record<string, string | undefined>;
  const logs = await prisma.auditLog.findMany({
    where: claimId ? { claimId } : {},
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(logs);
});
