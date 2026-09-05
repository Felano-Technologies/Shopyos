// utils/formatCurrency.ts
// Formats an amount as "₵X,XXX.XX" — many `₵${n.toFixed(2)}` call sites across
// the app skip thousands separators, so a price like 929282 renders as
// "₵929282.00" instead of "₵929,282.00". Uses toLocaleString, matching the
// convention already proven working elsewhere in this codebase (e.g.
// admin/revenue.tsx, business/dashboard.tsx) rather than a second approach.
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  return `₵${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
