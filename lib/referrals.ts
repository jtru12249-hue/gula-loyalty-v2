import "server-only";

import { createHash } from "node:crypto";

export const NEW_MEMBER_REFERRAL_BONUS = 300;
export const REFERRER_BONUS = 400;

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

export function referralCodeForMember(
  memberId: string,
) {
  const code = createHash("sha256")
    .update(memberId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();

  return `GULA-${code}`;
}
