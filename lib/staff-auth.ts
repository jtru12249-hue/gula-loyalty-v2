import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function isAuthorizedStaff(req: Request) {
  const configuredPin = process.env.STAFF_PIN;
  const suppliedPin = req.headers.get("x-staff-pin") ?? "";

  if (!configuredPin) {
    throw new Error("STAFF_PIN is not configured.");
  }

  return safeEqual(configuredPin, suppliedPin);
}
