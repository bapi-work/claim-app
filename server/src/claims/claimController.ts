import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";
import { requireAuth, AuthedRequest } from "../auth/authMiddleware";
import { upload } from "./upload";
import { checkClaimPolicy } from "./policyCheck";
import { convert } from "../lib/currency";
import { sendMail } from "../lib/mailer";
import { claimSummary } from "../lib/notify";

function withHomeCurrencyAmount<T extends { amount: unknown; currency: string; submitter: { homeCurrency: string } }>(
  claim: T
): T & { homeCurrencyAmount: number } {
  return {
    ...claim,
    homeCurrencyAmount: convert(Number(claim.amount), claim.currency, claim.submitter.homeCurrency),
  };
}

export const claimsRouter = Router();

claimsRouter.use(requireAuth);

const claimTypes = ["TRAVEL", "MEDICAL", "SUBSCRIPTION", "MILEAGE", "OTHER"] as const;

const createSchema = z.object({
  type: z.enum(claimTypes),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  selectedManagerId: z.string().uuid({ message: "Please select a manager to approve this claim" }),
});

async function assertIsManager(managerId: string, res: import("express").Response): Promise<boolean> {
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager || manager.role !== "MANAGER") {
    res.status(400).json({ error: "Selected approver must be a user with the Manager role" });
    return false;
  }
  return true;
}

claimsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!(await assertIsManager(parsed.data.selectedManagerId, res))) return;

  const claim = await prisma.claim.create({
    data: { ...parsed.data, submitterId: req.user!.id, status: "DRAFT" },
  });
  await logAudit({ actorId: req.user!.id, action: "CLAIM_CREATED", claimId: claim.id });
  res.status(201).json(claim);
});

const updateSchema = createSchema.partial();

claimsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const claim = await prisma.claim.findUnique({ where: { id: req.params.id } });
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.submitterId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
  if (claim.status !== "DRAFT") return res.status(409).json({ error: "Only draft claims can be edited" });

  if (parsed.data.selectedManagerId && !(await assertIsManager(parsed.data.selectedManagerId, res))) return;

  const updated = await prisma.claim.update({ where: { id: claim.id }, data: parsed.data });
  await logAudit({ actorId: req.user!.id, action: "CLAIM_UPDATED", claimId: claim.id });
  res.json(updated);
});

const submitterSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  managerId: true,
  homeCurrency: true,
} as const;

// List claims scoped by role: employee sees own, manager sees claims where they were chosen as
// approver, finance/HR/admin (back office) see all.
claimsRouter.get("/", async (req: AuthedRequest, res) => {
  const { role, id } = req.user!;
  let where = {};

  if (role === "EMPLOYEE") {
    where = { submitterId: id };
  } else if (role === "MANAGER") {
    where = { OR: [{ submitterId: id }, { selectedManagerId: id }] };
  }
  // FINANCE / HR / ADMIN: no filter, see all.

  const claims = await prisma.claim.findMany({
    where,
    include: {
      submitter: { select: submitterSelect },
      selectedManager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(claims.map(withHomeCurrencyAmount));
});

claimsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const claim = await prisma.claim.findUnique({
    where: { id: req.params.id },
    include: {
      submitter: { select: submitterSelect },
      selectedManager: { select: { id: true, name: true, email: true } },
      attachments: true,
      approvalSteps: {
        include: {
          approver: { select: { id: true, name: true, email: true } },
          decidedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { order: "asc" },
      },
      auditLogs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!claim) return res.status(404).json({ error: "Claim not found" });

  const { role, id } = req.user!;
  const isOwner = claim.submitterId === id;
  const isPrivileged = role === "ADMIN" || role === "FINANCE" || role === "HR";
  const isSelectedManager = claim.selectedManagerId === id;
  if (!isOwner && !isPrivileged && !isSelectedManager) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json(withHomeCurrencyAmount(claim));
});

claimsRouter.post("/:id/submit", async (req: AuthedRequest, res) => {
  const claim = await prisma.claim.findUnique({
    where: { id: req.params.id },
    include: { submitter: true, selectedManager: true },
  });
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.submitterId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
  if (claim.status !== "DRAFT") return res.status(409).json({ error: "Claim already submitted" });
  if (!claim.selectedManagerId || !claim.selectedManager) {
    return res.status(422).json({ error: "Please select a manager to approve this claim before submitting" });
  }

  const warnings = checkClaimPolicy({ amount: Number(claim.amount), createdAt: claim.createdAt });

  const [updated] = await prisma.$transaction([
    prisma.claim.update({
      where: { id: claim.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
    prisma.approvalStep.create({
      data: {
        claimId: claim.id,
        order: 1,
        approverRole: "MANAGER",
        approverId: claim.selectedManagerId,
        status: "PENDING",
      },
    }),
  ]);

  await logAudit({
    actorId: req.user!.id,
    action: "CLAIM_SUBMITTED",
    claimId: claim.id,
    details: { warnings },
  });

  sendMail({
    to: claim.selectedManager.email,
    subject: `Claim awaiting your approval: ${claim.title}`,
    text: `${claimSummary(claim)}. Please review it in Claim App.`,
  });

  res.json({ claim: updated, warnings });
});

claimsRouter.post("/:id/attachments", upload.single("file"), async (req: AuthedRequest, res) => {
  const claim = await prisma.claim.findUnique({ where: { id: req.params.id } });
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.submitterId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const attachment = await prisma.attachment.create({
    data: {
      claimId: claim.id,
      filename: req.file.originalname,
      storagePath: req.file.filename,
    },
  });
  await logAudit({ actorId: req.user!.id, action: "ATTACHMENT_UPLOADED", claimId: claim.id });
  res.status(201).json(attachment);
});
