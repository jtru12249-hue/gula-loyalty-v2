import "server-only";

/*
 * =========================================================
 * GULA REWARDS — REWARD BUSINESS RULES
 * =========================================================
 *
 * Keep reward-related values here so every part of the
 * application uses the exact same rules.
 */

// Customer needs 1,000 points to redeem one reward.
export const REWARD_COST = 1000;

// $1.00 spent = 10 GULA points.
export const POINTS_PER_DOLLAR = 10;

/*
 * Safely converts a Firestore points value into a usable
 * non-negative integer.
 */
export function normalizePoints(
  value: unknown,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(value),
  );
}

/*
 * Returns true when the member has enough points
 * to redeem a free reward.
 */
export function canRedeemReward(
  points: number,
) {
  return (
    normalizePoints(points) >=
    REWARD_COST
  );
}

/*
 * Returns the customer's points after redeeming
 * one reward.
 */
export function pointsAfterRedemption(
  points: number,
) {
  const safePoints =
    normalizePoints(points);

  if (
    safePoints <
    REWARD_COST
  ) {
    throw new Error(
      "Member does not have enough points to redeem this reward.",
    );
  }

  return (
    safePoints -
    REWARD_COST
  );
}
