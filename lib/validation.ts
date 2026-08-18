export function normalizeMemberId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 200);
}

export function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseSpendAmount(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid order total greater than $0.");
  }

  if (amount > 10000) {
    throw new Error("Order total is too large.");
  }

  const spendCents = Math.round(amount * 100);
  const normalizedAmount = spendCents / 100;

  // $1 = 10 points. Points remain whole numbers.
  const pointsEarned = Math.floor(spendCents / 10);

  if (pointsEarned < 1) {
    throw new Error("Order total must earn at least 1 point.");
  }

  return { spendCents, spendAmount: normalizedAmount, pointsEarned };
}
