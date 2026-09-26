import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import { REWARD_COST, safePoints } from "@/lib/rewards";
import { requireValidMemberId } from "@/lib/validation";

import {
  createWalletPass,
  updateWalletPass,
} from "@/lib/walletwallet";

export const runtime = "nodejs";


type RedemptionResult = {
  duplicate: boolean;
  memberId: string;
  name: string;
  newPoints: number;
  walletSerial: string | null;
  referralCode: string | null;
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

    let memberId: string;
    try {
      memberId = requireValidMemberId(body?.memberId);
    } catch {
      return jsonError("Invalid GULA Rewards QR code.", 400);
    }

    const idempotencyKey =
      typeof body?.idempotencyKey === "string"
        ? body.idempotencyKey
            .trim()
            .slice(0, 120)
        : "";

    if (!idempotencyKey) {
      return jsonError(
        "Missing redemption transaction id.",
        400,
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

          const currentPoints = safePoints(member.points);

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

          const referralCode =
            typeof member.referralCode ===
              "string"
              ? member.referralCode
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

              referralCode,
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
            referralCode,
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

        walletSynced: false,
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

              referralCode:
                result.referralCode ??
                undefined,

              logoURL,
            },
          );

        if (update.ok) {
          walletSynced = true;

          await memberRef.update({
            walletLogoApplied:
              update.logoApplied,

            lastUpdated:
              FieldValue.serverTimestamp(),
          });
        } else if (update.missing) {
          const replacement =
            await createWalletPass({
              memberId:
                result.memberId,

              name:
                result.name,

              points:
                result.newPoints,

              referralCode:
                result.referralCode ??
                undefined,

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

            referralCode:
              result.referralCode ??
              undefined,

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
