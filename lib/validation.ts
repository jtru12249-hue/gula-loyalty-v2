const MEMBER_ID_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const MAX_ORDER_CENTS = 1_000_000; // $10,000.00

export function normalizeMemberId(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, MEMBER_ID_MAX_LENGTH);
}

export function isValidMemberId(memberId: string) {
  if (!memberId) return false;

  if (memberId.length > MEMBER_ID_MAX_LENGTH) {
    return false;
  }

  // Firestore document IDs cannot contain "/".
  // Our loyalty QR should only contain a simple member document ID.
  if (memberId.includes("/")) {
    return false;
  }

  // Reject control characters and suspicious QR contents.
  if (/[\u0000-\u001F\u007F]/.test(memberId)) {
    return false;
  }

  // Firebase auto-generated document IDs are simple URL-safe strings.
  return /^[A-Za-z0-9_-]+$/.test(memberId);
}

export function requireValidMemberId(value: unknown) {
  const memberId = normalizeMemberId(value);

  if (!isValidMemberId(memberId)) {
    throw new Error(
      "This QR code is not a valid GULA Rewards member code.",
    );
  }

  return memberId;
}

export function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX_LENGTH);
}

export function isValidName(name: string) {
  if (name.length < 2 || name.length > NAME_MAX_LENGTH) {
    return false;
  }

  // Reject control characters while allowing international names,
  // accents, apostrophes, hyphens, periods, and spaces.
  return !/[\u0000-\u001F\u007F]/.test(name);
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toLowerCase()
    .slice(0, EMAIL_MAX_LENGTH);
}

export function isValidEmail(email: string) {
  if (!email || email.length > EMAIL_MAX_LENGTH) {
    return false;
  }

  if (email.includes("..")) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseSpendAmount(value: unknown) {
  let raw: string | number;

  if (typeof value === "number") {
    raw = value;
  } else if (typeof value === "string") {
    raw = value.trim();

    if (!raw) {
      throw new Error("Enter the order total.");
    }

    // Only accept normal dollar amounts such as:
    // 12
    // 12.5
    // 12.50
    //
    // This prevents strange values such as scientific notation.
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new Error(
        "Enter a valid order total with no more than 2 decimal places.",
      );
    }
  } else {
    throw new Error("Enter a valid order total.");
  }

  const amount =
    typeof raw === "number"
      ? raw
      : Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Enter a valid order total greater than $0.",
    );
  }

  const spendCents = Math.round(amount * 100);

  if (spendCents <= 0) {
    throw new Error(
      "Enter a valid order total greater than $0.",
    );
  }

  if (spendCents > MAX_ORDER_CENTS) {
    throw new Error(
      "Order total cannot be greater than $10,000.",
    );
  }

  const spendAmount = spendCents / 100;

  // GULA Rewards:
  // $1.00 = 10 points
  // $1.25 = 12 points
  // $10.99 = 109 points
  const pointsEarned =
    Math.floor(spendCents / 10);

  if (pointsEarned < 1) {
    throw new Error(
      "Order total must earn at least 1 point.",
    );
  }

  return {
    spendCents,
    spendAmount,
    pointsEarned,
  };
}
