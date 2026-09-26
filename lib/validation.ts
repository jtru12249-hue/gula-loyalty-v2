import "server-only";

import { createHash } from "node:crypto";

export const NEW_MEMBER_REFERRAL_BONUS = 300;
export const REFERRER_BONUS = 400;
export const REFERRAL_PREFIX = "GULA-";
export const REFERRAL_HASH_LENGTH = 12;

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

export function isValidReferralCode(value: unknown) {
  const code = normalizeReferralCode(value);
  return /^GULA-[A-F0-9]{8,16}$/.test(code);
}

export function referralCodeForMember(memberId: string, attempt = 0) {
  if (!memberId.trim() || !Number.isInteger(attempt) || attempt < 0) {
    throw new Error("INVALID_REFERRAL_CODE_INPUT");
  }

  const source = attempt === 0 ? memberId : `${memberId}:${attempt}`;
  const hash = createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, REFERRAL_HASH_LENGTH)
    .toUpperCase();

  return `${REFERRAL_PREFIX}${hash}`;
}

export function safeReferralCode(value: unknown) {
  const code = normalizeReferralCode(value);
  return isValidReferralCode(code) ? code : null;
}
