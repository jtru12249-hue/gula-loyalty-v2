import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import { REWARD_COST, safePoints } from "@/lib/rewards";
import { requireValidMemberId } from "@/lib/validation";

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

    let memberId: string;
    try {
      memberId = requireValidMemberId(body?.memberId);
    } catch {
      return jsonError("Invalid GULA Rewards QR code.");
    }

    const memberSnap = await adminDb
      .collection("members")
      .doc(memberId)
      .get();

    if (!memberSnap.exists) {
      return jsonError("Member not found.", 404);
    }

    const member = memberSnap.data() ?? {};

    const points = safePoints(member.points);

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

        rewardEligible: points >= REWARD_COST,

        pointsToReward: Math.max(
          0,
          REWARD_COST - points,
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
