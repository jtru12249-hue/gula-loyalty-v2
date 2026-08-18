import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import { normalizeMemberId } from "@/lib/validation";

import {
  createWalletPass,
  updateWalletPass,
} from "@/lib/walletwallet";

export const runtime = "nodejs";

const REWARD_COST = 1000;

type RedemptionResult = {
  duplicate: boolean;
  memberId: string;
  name: string;
  newPoints: number;
  walletSerial: string | null;
};

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

    const idempotencyKey =
      typeof body?.idempotencyKey === "string"
        ? body.idempotencyKey
            .trim()
            .slice(0, 120)
        : "";

    if (!memberId) {
      return jsonError(
        "Invalid member QR code.",
      );
    }

    if (!idempotencyKey) {
      return jsonError(
        "Missing redemption transaction id.",
      );
    }

    const memberRef = adminDb
      .collection("members")
      .doc(memberId);

    const redemptionRef = adminDb
      .collection("rewardRedemptions")
      .doc(idempotencyKey);

    const result =
      await adminDb.runTransaction<RedemptionResult>(
        async (transaction) => {
          const memberSnap =
            await transaction.get(memberRef);

          const existingRedemption =
            await transaction.get(
              redemptionRef,
            );

          if (!memberSnap.exists) {
            throw new Error(
              "MEMBER_NOT_FOUND",
            );
          }

          const member =
            memberSnap.data() ?? {};

          const currentPoints = Math.max(
            0,
            Number(member.points ?? 0),
          );

          const name =
            typeof member.name ===
              "string" &&
            member.name.trim()
              ? member.name.trim()
              : "GULA Member";

          const walletSerial =
            typeof member.walletSerial ===
            "string"
              ? member.walletSerial
              : null;

          if (existingRedemption.exists) {
            const existing =
              existingRedemption.data() ??
              {};

            return {
              duplicate: true,
              memberId,
              name,

              newPoints: Number(
                existing.newPoints ??
                  currentPoints,
              ),

              walletSerial,
            };
          }

          if (
            currentPoints <
            REWARD_COST
          ) {
            throw new Error(
              "NOT_ENOUGH_POINTS",
            );
          }

          const newPoints =
            currentPoints -
            REWARD_COST;

          transaction.update(
            memberRef,
            {
              points: newPoints,

              lastUpdated:
                FieldValue.serverTimestamp(),
            },
          );

          transaction.set(
            redemptionRef,
            {
              memberId,

              reward:
                "FREE_REWARD",

              pointsCost:
                REWARD_COST,

              previousPoints:
                currentPoints,

              newPoints,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );

          const ledgerRef =
            adminDb
              .collection(
                "pointTransactions",
              )
              .doc();

          transaction.set(
            ledgerRef,
            {
              type:
                "reward_redemption",

              memberId,

              pointsDelta:
                -REWARD_COST,

              previousPoints:
                currentPoints,

              newPoints,

              redemptionId:
                idempotencyKey,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );

          return {
            duplicate: false,
            memberId,
            name,
            newPoints,
            walletSerial,
          };
        },
      );

    if (result.duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,

        memberId:
          result.memberId,

        memberName:
          result.name,

        pointsRedeemed:
          REWARD_COST,

        newPoints:
          result.newPoints,

        walletSynced: true,
      });
    }

    const logoURL = new URL(
      "/gula-wallet-logo.png",
      req.url,
    ).toString();

    let walletSynced = false;

    try {
      if (result.walletSerial) {
        const update =
          await updateWalletPass(
            result.walletSerial,
            {
              memberId:
                result.memberId,

              name:
                result.name,

              points:
                result.newPoints,

              logoURL,
            },
          );

        if (update.ok) {
          walletSynced = true;
        } else if (update.missing) {
          const replacement =
            await createWalletPass({
              memberId:
                result.memberId,

              name:
                result.name,

              points:
                result.newPoints,

              logoURL,
            });

          await memberRef.update({
            walletSerial:
              replacement.serialNumber,

            passUrl:
              replacement.shareUrl,

            googleSaveUrl:
              replacement.googleSaveUrl,

            walletLogoApplied:
              replacement.logoApplied,

            lastUpdated:
              FieldValue.serverTimestamp(),
          });

          walletSynced = true;
        }
      } else {
        const replacement =
          await createWalletPass({
            memberId:
              result.memberId,

            name:
              result.name,

            points:
              result.newPoints,

            logoURL,
          });

        await memberRef.update({
          walletSerial:
            replacement.serialNumber,

          passUrl:
            replacement.shareUrl,

          googleSaveUrl:
            replacement.googleSaveUrl,

          walletLogoApplied:
            replacement.logoApplied,

          lastUpdated:
            FieldValue.serverTimestamp(),
        });

        walletSynced = true;
      }
    } catch (walletError) {
      console.error(
        "Wallet redemption sync failed",
        walletError,
      );
    }

    return NextResponse.json({
      success: true,

      memberId:
        result.memberId,

      memberName:
        result.name,

      pointsRedeemed:
        REWARD_COST,

      newPoints:
        result.newPoints,

      walletSynced,
    });
  } catch (error: unknown) {
    const message =
      getErrorMessage(error);

    console.error(
      "redeem-reward failed",
      error,
    );

    if (
      message ===
      "MEMBER_NOT_FOUND"
    ) {
      return jsonError(
        "Member not found.",
        404,
      );
    }

    if (
      message ===
      "NOT_ENOUGH_POINTS"
    ) {
      return jsonError(
        "This member does not have enough points to redeem the free reward.",
        409,
      );
    }

    return jsonError(
      message,
      500,
    );
  }
}
