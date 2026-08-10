export type ClaimType = "TRAVEL" | "MEDICAL" | "SUBSCRIPTION" | "MILEAGE" | "OTHER";
export type ClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ChainRole = "MANAGER" | "FINANCE" | "HR";

export interface Submitter {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  managerId?: string | null;
  homeCurrency?: string;
}

export interface PartyRef {
  id: string;
  name: string;
  email: string;
}

export interface Claim {
  id: string;
  submitterId: string;
  submitter?: Submitter;
  selectedManagerId?: string | null;
  selectedManager?: PartyRef | null;
  type: ClaimType;
  title: string;
  description?: string | null;
  amount: string;
  currency: string;
  homeCurrencyAmount?: number;
  status: ClaimStatus;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  approvalSteps?: ApprovalStep[];
  auditLogs?: AuditLog[];
}

export interface Attachment {
  id: string;
  claimId: string;
  filename: string;
  storagePath: string;
  uploadedAt: string;
}

export interface ApprovalStep {
  id: string;
  claimId: string;
  claim?: Claim;
  order: number;
  approverRole: ChainRole;
  approverId?: string | null;
  approver?: PartyRef | null;
  decidedById?: string | null;
  decidedBy?: PartyRef | null;
  status: ApprovalStatus;
  comment?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  claimId?: string | null;
  actorId: string;
  actor?: { id: string; name: string; email: string };
  action: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}
