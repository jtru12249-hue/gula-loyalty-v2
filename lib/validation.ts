const MEMBER_ID_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const MAX_ORDER_CENTS = 1_000_000;

export function normalizeMemberId(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MEMBER_ID_MAX_LENGTH);
}

export function isValidMemberId(memberId: string) {
  return (
    memberId.length > 0 &&
    memberId.length <= MEMBER_ID_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(memberId)
  );
}

export function requireValidMemberId(value: unknown) {
  const memberId = normalizeMemberId(value);
  if (!isValidMemberId(memberId)) {
    throw new Error("INVALID_MEMBER_ID");
  }
  return memberId;
}

export function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, NAME_MAX_LENGTH);
}

export function isValidName(name: string) {
  return (
    name.length >= 2 &&
    name.length <= NAME_MAX_LENGTH &&
    !/[\u0000-\u001F\u007F]/.test(name)
  );
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, EMAIL_MAX_LENGTH);
}

export function isValidEmail(email: string) {
  return (
    email.length > 0 &&
    email.length <= EMAIL_MAX_LENGTH &&
    !email.includes("..") &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

export function parseSpendAmount(value: unknown) {
  let amount: number;

  if (typeof value === "number") {
    amount = value;
  } else if (typeof value === "string") {
    const raw = value.trim();
    if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new Error("INVALID_SPEND_AMOUNT");
    }
    amount = Number(raw);
  } else {
    throw new Error("INVALID_SPEND_AMOUNT");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("INVALID_SPEND_AMOUNT");
  }

  const spendCents = Math.round(amount * 100);
  if (spendCents <= 0 || spendCents > MAX_ORDER_CENTS) {
    throw new Error("INVALID_SPEND_AMOUNT");
  }

  const pointsEarned = Math.floor(spendCents / 10);
  if (pointsEarned < 1) {
    throw new Error("ORDER_EARNS_NO_POINTS");
  }

  return {
    spendCents,
    spendAmount: spendCents / 100,
    pointsEarned,
  };
}
