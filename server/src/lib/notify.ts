import { prisma } from "./prisma";
import { sendMailToMany } from "./mailer";
import { Role } from "@prisma/client";

interface ClaimForNotify {
  id: string;
  title: string;
  type: string;
  currency: string;
  amount: unknown;
  submitter: { id: string; name: string; email: string };
  selectedManager: { id: string; name: string; email: string } | null;
}

// Everyone with a stake in this claim so far: the submitter, the chosen manager, and anyone
// who has already made a decision on one of its steps (finance/HR reviewers once they've acted).
export async function getPartyEmails(claimId: string, claim: ClaimForNotify): Promise<string[]> {
  const steps = await prisma.approvalStep.findMany({
    where: { claimId, decidedById: { not: null } },
    include: { decidedBy: { select: { email: true } } },
  });

  const emails = [claim.submitter.email, claim.selectedManager?.email, ...steps.map((s) => s.decidedBy?.email)];

  return emails.filter((e): e is string => Boolean(e));
}

export async function notifyRoleGroup(role: Role, subject: string, text: string): Promise<void> {
  const users = await prisma.user.findMany({ where: { role }, select: { email: true } });
  sendMailToMany({ to: users.map((u) => u.email), subject, text });
}

export function claimSummary(claim: ClaimForNotify): string {
  return `${claim.type} claim "${claim.title}" for ${claim.currency} ${claim.amount} submitted by ${claim.submitter.name}`;
}
