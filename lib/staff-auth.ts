import { createHmac, timingSafeEqual } from "node:crypto";

export const STAFF_SESSION_COOKIE = "gula_staff_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function sessionSecret() {
  const secret = process.env.STAFF_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("STAFF_SESSION_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function verifyStaffPin(value: unknown) {
  const configuredPin = process.env.STAFF_PIN;
  if (!configuredPin) throw new Error("STAFF_PIN is not configured.");
  const suppliedPin = typeof value === "string" ? value.trim() : "";
  if (!suppliedPin || suppliedPin.length > 64) return false;
  return safeEqual(configuredPin, suppliedPin);
}

export function createStaffSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_DURATION_SECONDS };
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
}

export function isAuthorizedStaff(req: Request) {
  const token = readCookie(req, STAFF_SESSION_COOKIE);
  const [expiresRaw, signature, ...extra] = token.split(".");
  if (!expiresRaw || !signature || extra.length > 0) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(sign(expiresRaw), signature);
}
