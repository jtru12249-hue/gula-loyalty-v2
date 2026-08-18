import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import { normalizeMemberId } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!isAuthorizedStaff(req)) {
      return jsonError(
        "Unauthorized staff terminal.",
        401,
      );
    }

    const body = await req.json();

    const memberId = normalizeMemberId(
      body?.memberId,
    );

    if (!memberId) {
      return jsonError("Invalid member QR code.");
    }

    const memberSnap = await adminDb
      .collection("members")
      .doc(memberId)
      .get();

    if (!memberSnap.exists) {
      return jsonError("Member not found.", 404);
    }

    const member = memberSnap.data() ?? {};

    const points = Math.max(
      0,
      Number(member.points ?? 0),
    );

    const name =
      typeof member.name === "string" &&
      member.name.trim()
        ? member.name.trim()
        : "GULA Member";

    return NextResponse.json({
      success: true,

      member: {
        memberId,
        name,
        points,

        rewardEligible: points >= 1000,

        pointsToReward: Math.max(
          0,
          1000 - points,
        ),
      },
    });
  } catch (error: unknown) {
    console.error(
      "member-info failed",
      error,
    );

    return jsonError(
      getErrorMessage(error),
      500,
    );
  }
}
