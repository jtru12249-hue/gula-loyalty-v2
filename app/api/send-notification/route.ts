import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import { updateWalletPass } from "@/lib/walletwallet";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 120;

export async function POST(req: Request) {
  try {
    if (!isAuthorizedStaff(req)) {
      return jsonError(
        "Unauthorized staff terminal.",
        401,
      );
    }

    const body = await req.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return jsonError(
        "Enter a notification message.",
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError(
        `Notification must be ${MAX_MESSAGE_LENGTH} characters or less.`,
      );
    }

    const membersSnap = await adminDb
      .collection("members")
      .get();

    const members = membersSnap.docs
      .map((doc) => {
        const data = doc.data();

        return {
          memberId: doc.id,

          name:
            typeof data.name === "string"
              ? data.name
              : "GULA Member",

          points: Math.max(
            0,
            Number(data.points ?? 0),
          ),

          walletSerial:
            typeof data.walletSerial === "string"
              ? data.walletSerial
              : null,
        };
      })
      .filter((member) => member.walletSerial);

    if (members.length === 0) {
      return jsonError(
        "No members with Wallet passes were found.",
        404,
      );
    }

    const logoURL = new URL(
      "/gula-wallet-logo.png",
      req.url,
    ).toString();

    let successful = 0;
    let failed = 0;

    const batchSize = 5;

    for (
      let i = 0;
      i < members.length;
      i += batchSize
    ) {
      const batch = members.slice(
        i,
        i + batchSize,
      );

      const results =
        await Promise.allSettled(
          batch.map((member) =>
            updateWalletPass(
              member.walletSerial as string,
              {
                memberId:
                  member.memberId,

                name:
                  member.name,

                points:
                  member.points,

                logoURL,

                promoMessage:
                  message,
              },
            ),
          ),
        );

      for (const result of results) {
        if (
          result.status === "fulfilled" &&
          result.value.ok
        ) {
          successful += 1;
        } else {
          failed += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message,
      totalMembers:
        members.length,
      successful,
      failed,
    });
  } catch (error) {
    console.error(
      "send-notification failed",
      error,
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to send notification.",
      500,
    );
  }
}
