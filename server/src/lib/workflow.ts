// The fixed 3-stage approval chain: Manager -> Finance -> HR (final step disburses funds).
export const APPROVAL_CHAIN = ["MANAGER", "FINANCE", "HR"] as const;
export type ApprovalChainRole = (typeof APPROVAL_CHAIN)[number];

export function roleForOrder(order: number): ApprovalChainRole {
  const role = APPROVAL_CHAIN[order - 1];
  if (!role) throw new Error(`No chain role for order ${order}`);
  return role;
}

export function nextOrder(order: number): number | null {
  return order < APPROVAL_CHAIN.length ? order + 1 : null;
}

export function isFinalOrder(order: number): boolean {
  return order === APPROVAL_CHAIN.length;
}
