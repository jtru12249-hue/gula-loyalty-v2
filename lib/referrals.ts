import "server-only";

import { createHash } from "node:crypto";

/*
 * =========================================================
 * GULA REWARDS — REFERRAL BUSINESS RULES
 * =========================================================
 *
 * Keep referral-related business rules here so we don't
 * repeat magic numbers throughout the application.
 */

export const NEW_MEMBER_REFERRAL_BONUS = 300;
export const REFERRER_BONUS = 400;

/*
 * New referral codes use 12 hexadecimal characters.
 *
 * Example:
 * GULA-A82F91BC73D2
 *
 * Older 8-character codes such as:
 * GULA-A82F91BC
 *
 * continue to work because we never regenerate an existing
 * member's referral code.
 */
export const REFERRAL_HASH_LENGTH = 12;

export const REFERRAL_PREFIX = "GULA-";

const MAX_REFERRAL_CODE_LENGTH = 40;

/*
 * Converts user input into the canonical referral-code format.
 *
 * Examples:
 *
 * " gula-ab12cd34 "
 * becomes
 * "GULA-AB12CD34"
 *
 * Spaces are removed because customers may copy/paste codes
 * from text messages or screenshots.
 */
export function normalizeReferralCode(
  value: unknown,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(
      0,
      MAX_REFERRAL_CODE_LENGTH,
    );
}

/*
 * Validates both:
 *
 * Legacy codes:
 * GULA-A82F91BC
 *
 * New codes:
 * GULA-A82F91BC73D2
 *
 * This means upgrading the referral system does NOT invalidate
 * codes already given to existing GULA customers.
 */
export function isValidReferralCode(
  value: unknown,
) {
  const code =
    normalizeReferralCode(value);

  if (!code) {
    return false;
  }

  return /^GULA-[A-F0-9]{8,16}$/.test(
    code,
  );
}

/*
 * Generates a deterministic referral code from the member's
 * Firestore document ID.
 *
 * We include an optional attempt number so the signup system
 * can generate another deterministic candidate in the extremely
 * unlikely event of a referral-code collision.
 *
 * attempt 0:
 * GULA-A82F91BC73D2
 *
 * attempt 1:
 * produces a different code for the same member
 */
export function referralCodeForMember(
  memberId: string,
  attempt = 0,
) {
  if (
    typeof memberId !== "string" ||
    !memberId.trim()
  ) {
    throw new Error(
      "Cannot create a referral code without a member ID.",
    );
  }

  if (
    !Number.isInteger(attempt) ||
    attempt < 0
  ) {
    throw new Error(
      "Invalid referral code generation attempt.",
    );
  }

  const source =
    attempt === 0
      ? memberId
      : `${memberId}:${attempt}`;

  const hash = createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(
      0,
      REFERRAL_HASH_LENGTH,
    )
    .toUpperCase();

  return `${REFERRAL_PREFIX}${hash}`;
}

/*
 * Useful for safely displaying referral codes in API responses,
 * Wallet passes, etc.
 *
 * Returns null instead of passing malformed data through the app.
 */
export function safeReferralCode(
  value: unknown,
) {
  const code =
    normalizeReferralCode(value);

  return isValidReferralCode(code)
    ? code
    : null;
}
