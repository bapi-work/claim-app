import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logAudit } from "../lib/audit";
import { requireAuth, requireRole, AuthedRequest } from "../auth/authMiddleware";
import { sendMailToMany } from "../lib/mailer";
import { getPartyEmails, notifyRoleGroup, claimSummary } from "../lib/notify";
import { nextOrder, roleForOrder } from "../lib/workflow";
import { Role } from "@prisma/client";

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth, requireRole("MANAGER", "FINANCE", "HR", "ADMIN"));

const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().optional(),
  })
  .refine((data) => data.decision !== "REJECTED" || (data.comment && data.comment.trim().length > 0), {
    message: "A reason is required when rejecting a claim",
    path: ["comment"],
  });

approvalsRouter.post("/:claimId/decision", async (req: AuthedRequest, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { decision, comment } = parsed.data;

  const claim = await prisma.claim.findUnique({
    where: { id: req.params.claimId },
    include: {
      approvalSteps: { where: { status: "PENDING" }, orderBy: { order: "asc" }, take: 1 },
      submitter: true,
      selectedManager: true,
    },
  });
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  if (claim.status !== "SUBMITTED") return res.status(409).json({ error: "Claim is not pending approval" });

  const step = claim.approvalSteps[0];
  if (!step) return res.status(409).json({ error: "No pending approval step for this claim" });

  const { role, id } = req.user!;
  const isAssignedApprover = step.approverId ? step.approverId === id : false;
  const isRoleMatch = !step.approverId && step.approverRole === role;
  const canOverride = role === "ADMIN";
  if (!isAssignedApprover && !isRoleMatch && !canOverride) {
    return res.status(403).json({ error: "You are not the assigned approver for this claim" });
  }

  const actor = await prisma.user.findUnique({ where: { id } });
  const stepRoleLabel = step.approverRole;

  if (decision === "REJECTED") {
    await prisma.$transaction([
      prisma.approvalStep.update({
        where: { id: step.id },
        data: { status: "REJECTED", comment, decidedAt: new Date(), decidedById: id },
      }),
      prisma.claim.update({ where: { id: claim.id }, data: { status: "REJECTED" } }),
    ]);

    await logAudit({ actorId: id, action: "CLAIM_REJECTED", claimId: claim.id, details: { comment, stage: stepRoleLabel } });

    const parties = await getPartyEmails(claim.id, claim);
    sendMailToMany({
      to: parties,
      subject: `Claim rejected: ${claim.title}`,
      text: `${claimSummary(claim)} was rejected at the ${stepRoleLabel} stage by ${actor?.name ?? "an approver"}.\n\nReason: ${comment}`,
    });

    const updated = await prisma.claim.findUnique({ where: { id: claim.id } });
    return res.json(updated);
  }

  // APPROVED
  const upcomingOrder = nextOrder(step.order);

  if (!upcomingOrder) {
    // Final stage (HR) approved: claim is fully approved and funds are disbursed.
    await prisma.$transaction([
      prisma.approvalStep.update({
        where: { id: step.id },
        data: { status: "APPROVED", comment, decidedAt: new Date(), decidedById: id },
      }),
      prisma.claim.update({ where: { id: claim.id }, data: { status: "PAID" } }),
    ]);

    await logAudit({ actorId: id, action: "CLAIM_PAID", claimId: claim.id, details: { comment, stage: stepRoleLabel } });

    const parties = await getPartyEmails(claim.id, claim);
    sendMailToMany({
      to: parties,
      subject: `Claim approved and funds disbursed: ${claim.title}`,
      text: `${claimSummary(claim)} was approved by ${actor?.name ?? "HR"} at the final HR stage. Funds have been disbursed.`,
    });
  } else {
    const nextRole = roleForOrder(upcomingOrder);
    await prisma.$transaction([
      prisma.approvalStep.update({
        where: { id: step.id },
        data: { status: "APPROVED", comment, decidedAt: new Date(), decidedById: id },
      }),
      prisma.approvalStep.create({
        data: { claimId: claim.id, order: upcomingOrder, approverRole: nextRole, status: "PENDING" },
      }),
    ]);

    await logAudit({
      actorId: id,
      action: "CLAIM_APPROVED",
      claimId: claim.id,
      details: { comment, stage: stepRoleLabel, nextStage: nextRole },
    });

    const parties = await getPartyEmails(claim.id, claim);
    sendMailToMany({
      to: parties,
      subject: `Claim approved by ${stepRoleLabel}: ${claim.title}`,
      text: `${claimSummary(claim)} was approved by ${actor?.name ?? stepRoleLabel} at the ${stepRoleLabel} stage. It has moved to ${nextRole} for review.`,
    });

    await notifyRoleGroup(
      nextRole,
      `Claim awaiting your review: ${claim.title}`,
      `${claimSummary(claim)} has moved to the ${nextRole} stage and is awaiting your review.`
    );
  }

  const updated = await prisma.claim.findUnique({ where: { id: claim.id } });
  res.json(updated);
});

// Pending approvals visible to the current user: steps specifically assigned to them, or
// role-based steps matching their role. Admin sees everything (override capability).
approvalsRouter.get("/queue", async (req: AuthedRequest, res) => {
  const { role, id } = req.user!;

  const where =
    role === "ADMIN"
      ? { status: "PENDING" as const }
      : {
          status: "PENDING" as const,
          OR: [{ approverId: id }, { approverId: null, approverRole: role as Role }],
        };

  const steps = await prisma.approvalStep.findMany({
    where,
    include: {
      claim: {
        include: {
          submitter: { select: { id: true, name: true, email: true, department: true } },
          selectedManager: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(steps);
});
