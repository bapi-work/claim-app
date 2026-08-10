import { ApprovalStatus, ClaimStatus } from "../types";

const CLAIM_STATUS_STYLES: Record<ClaimStatus, string> = {
  DRAFT: "badge-neutral",
  SUBMITTED: "badge-info",
  APPROVED: "badge-success",
  REJECTED: "badge-danger",
  PAID: "badge-success",
};

const APPROVAL_STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: "badge-warning",
  APPROVED: "badge-success",
  REJECTED: "badge-danger",
};

export function StatusBadge({ status }: { status: ClaimStatus | ApprovalStatus }) {
  const className = CLAIM_STATUS_STYLES[status as ClaimStatus] ?? APPROVAL_STATUS_STYLES[status as ApprovalStatus] ?? "badge-neutral";
  return (
    <span className={`badge ${className}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}
