import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import {
  createStaffSession,
  STAFF_SESSION_COOKIE,
  verifyStaffPin,
  isAuthorizedStaff,
} from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return NextResponse.json({
    success: true,
    authenticated: isAuthorizedStaff(req),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!verifyStaffPin(body?.pin)) {
      return jsonError("Incorrect staff PIN.", 401);
    }

    const session = createStaffSession();
    const response = NextResponse.json({ success: true });
    response.cookies.set(STAFF_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    console.error("staff-session login failed", error);
    return jsonError("Unable to start staff session.", 500);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
