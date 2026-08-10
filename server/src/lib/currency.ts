import { prisma } from "./prisma";

// Fixed conversion table (units of currency per 1 USD). This is a static approximation for
// the MVP — a future iteration can swap this module for a live FX-rate provider without
// touching callers, since they only depend on convert()/SUPPORTED_CURRENCIES.
const RATES_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  JPY: 149.5,
  AUD: 1.52,
  CAD: 1.36,
  SGD: 1.34,
  AED: 3.67,
  CNY: 7.24,
};

export const SUPPORTED_CURRENCIES = Object.keys(RATES_PER_USD);

export function isSupportedCurrency(code: string): boolean {
  return code in RATES_PER_USD;
}

export function convert(amount: number, from: string, to: string): number {
  const fromRate = RATES_PER_USD[from];
  const toRate = RATES_PER_USD[to];
  if (!fromRate || !toRate) return amount;
  const usd = amount / fromRate;
  return Math.round(usd * toRate * 100) / 100;
}

// The org-wide default set on the Branding page — used to seed new users'/claims' currency
// instead of hardcoding "USD" everywhere.
export async function getDefaultCurrency(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return settings?.defaultCurrency ?? "USD";
}
