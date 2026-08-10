const HIGH_VALUE_THRESHOLD = 5000;
const SUBMISSION_WINDOW_DAYS = 90;

export function checkClaimPolicy(params: {
  amount: number;
  createdAt: Date;
  duplicateOf?: string;
}): string[] {
  const warnings: string[] = [];

  if (params.amount > HIGH_VALUE_THRESHOLD) {
    warnings.push(`Amount exceeds high-value threshold of $${HIGH_VALUE_THRESHOLD}`);
  }

  const ageDays = (Date.now() - params.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > SUBMISSION_WINDOW_DAYS) {
    warnings.push(`Claim is being submitted more than ${SUBMISSION_WINDOW_DAYS} days after creation`);
  }

  if (params.duplicateOf) {
    warnings.push(`Possible duplicate of claim ${params.duplicateOf}`);
  }

  return warnings;
}
