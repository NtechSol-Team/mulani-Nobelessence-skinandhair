// Money helpers shared by the client (live totals) and the server (source of truth).
//
// Why this exists: bill amounts used to be raw floats. A 20% discount on 2465.48
// gave a payable of 1972.384 while the UI only shows/accepts 2 decimals, so the
// patient could pay 1972.38 and the bill stayed "pending" forever (0.004 > 0).
// Everything below rounds to paise before comparing, and the final payable
// amount is always a whole rupee.

export type DiscountType = "Percentage" | "INR";

/**
 * How the final payable amount is rounded to a whole rupee.
 *   "nearest" -> 111.67 => 112, 111.40 => 111   (standard round-off)
 *   "up"      -> 111.67 => 112, 111.10 => 112
 *   "down"    -> 111.67 => 111, 111.90 => 111   (paise are waived)
 */
export const FINAL_AMOUNT_ROUNDING: "nearest" | "up" | "down" = "nearest";

/** Round to 2 decimals (paise), tolerant of binary float noise like 1972.3800000000001. */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + 1e-9) * 100)) / 100;
}

/** The final payable amount of a bill is always a whole rupee (no decimal point). */
export function roundFinalAmount(n: number): number {
  const v = roundMoney(n); // strip float noise first so 111.0000000001 doesn't ceil to 112
  if (v <= 0) return 0;
  switch (FINAL_AMOUNT_ROUNDING) {
    case "up":
      return Math.ceil(v);
    case "down":
      return Math.floor(v);
    default:
      return Math.round(v);
  }
}

/** Display helper: whole rupees show without a decimal point, paise (legacy bills / part payments) show 2 places. */
export function formatMoney(n: number): string {
  const v = roundMoney(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** Amount still owed. Compared at paise precision so float dust never counts as pending. */
export function calcPending(finalAmount: number, amountPaid: number): number {
  return Math.max(0, roundMoney(finalAmount - amountPaid));
}

/** True only when there is a real (>= 1 paisa) amount outstanding. */
export function isPending(bill: { pendingAmount: number }): boolean {
  return roundMoney(bill.pendingAmount) > 0;
}

/** Discount amount (in rupees) for a gross amount, capped so it never exceeds the gross. */
export function calcDiscountAmount(gross: number, type: DiscountType, value: number): number {
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  const raw = type === "Percentage" ? (gross * Math.min(v, 100)) / 100 : v;
  return roundMoney(Math.min(raw, Math.max(0, gross)));
}

export interface TreatmentLineInput {
  price: number;
  discountType?: DiscountType;
  discountValue?: number;
}

/** Per-treatment discount + net total. `price` is the gross (pre-discount) price. */
export function calcTreatmentLine(t: TreatmentLineInput): { discount: number; total: number } {
  const price = roundMoney(Math.max(0, t.price || 0));
  const discount = calcDiscountAmount(price, t.discountType ?? "Percentage", t.discountValue ?? 0);
  return { discount, total: roundMoney(price - discount) };
}

/** Net line total of a bill treatment. Bills saved before per-treatment discounts have no `total`. */
export function treatmentNet(t: { price: number; total?: number }): number {
  return typeof t.total === "number" ? t.total : t.price;
}

/**
 * Split a saved bill's (grandTotal -> finalAmount) gap into the real bill-level discount and the
 * round-off, so a round-off is never displayed as if it were a discount. Bills saved before
 * rounding existed have a round-off of 0.
 */
export function billBreakdown(bill: {
  grandTotal: number;
  discount: number;
  discountType: DiscountType;
  finalAmount: number;
}): { billDiscountAmount: number; roundOff: number } {
  const billDiscountAmount = calcDiscountAmount(bill.grandTotal, bill.discountType, bill.discount);
  const roundOff = roundMoney(bill.finalAmount - (bill.grandTotal - billDiscountAmount));
  return { billDiscountAmount, roundOff };
}

export interface BillTotalsInput {
  treatments: TreatmentLineInput[];
  medicines: { total: number }[];
  discount: number;
  discountType: DiscountType;
  amountPaid: number;
}

export interface BillTotals {
  treatmentTotal: number; // net of per-treatment discounts
  medicineTotal: number; // net of per-medicine discounts
  grandTotal: number; // treatmentTotal + medicineTotal
  billDiscountAmount: number; // bill-level discount in rupees
  roundOff: number; // adjustment added/removed to reach a whole rupee
  finalAmount: number; // whole-rupee payable amount
  amountPaid: number;
  pendingAmount: number;
}

/** Single source of truth for bill math. The server re-runs this before saving. */
export function calcBillTotals(input: BillTotalsInput): BillTotals {
  const treatmentTotal = roundMoney(
    input.treatments.reduce((sum, t) => sum + calcTreatmentLine(t).total, 0),
  );
  const medicineTotal = roundMoney(input.medicines.reduce((sum, m) => sum + (m.total || 0), 0));
  const grandTotal = roundMoney(treatmentTotal + medicineTotal);
  const billDiscountAmount = calcDiscountAmount(grandTotal, input.discountType, input.discount);
  const payable = roundMoney(grandTotal - billDiscountAmount);
  const finalAmount = roundFinalAmount(payable);
  const roundOff = roundMoney(finalAmount - payable);
  const amountPaid = roundMoney(input.amountPaid);
  return {
    treatmentTotal,
    medicineTotal,
    grandTotal,
    billDiscountAmount,
    roundOff,
    finalAmount,
    amountPaid,
    pendingAmount: calcPending(finalAmount, amountPaid),
  };
}
