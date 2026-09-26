import "server-only";

export const REWARD_COST = 1000;
export const POINTS_PER_DOLLAR = 10;

export function safePoints(value: unknown) {
  const points = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(points)) return 0;
  return Math.max(0, Math.floor(points));
}

export const normalizePoints = safePoints;

export function canRedeemReward(points: unknown) {
  return safePoints(points) >= REWARD_COST;
}

export function pointsAfterRedemption(points: unknown) {
  const currentPoints = safePoints(points);
  if (currentPoints < REWARD_COST) throw new Error("NOT_ENOUGH_POINTS");
  return currentPoints - REWARD_COST;
}
