import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import { isAuthorizedStaff } from "@/lib/staff-auth";
import {
  normalizeMemberId,
  parseSpendAmount,
} from "@/lib/validation";
import {
  createWalletPass,
  updateWalletPass,
} from "@/lib/walletwallet";

export const runtime = "nodejs";

type TransactionResult = {
  duplicate: boolean;
  memberId: string;
  name: string;
  newPoints: number;
  pointsEarned: number;
  walletSerial: string | null;
};

export async function POST(req: Request) {
  try {
    if (!isAuthorizedStaff(req)) {
      return jsonError("Unauthorized staff terminal.", 401);
    }

    const body = await req.json();
    const memberId = normalizeMemberId(body?.memberId);
    const idempotencyKey =
      typeof body?.idempotencyKey === "string"
        ? body.idempotencyKey.trim().slice(0, 120)
        : "";

    if (!memberId) {
      return jsonError("Invalid member QR code.");
    }

    if (!idempotencyKey) {
      return jsonError("Missing transaction id.");
    }

    const { spendAmount, spendCents, pointsEarned } = parseSpendAmount(
      body?.spendAmount,
    );

    const memberRef = adminDb.collection("members").doc(memberId);
    const txRef = adminDb.collection("pointTransactions").doc(idempotencyKey);

    const result = await adminDb.runTransaction<TransactionResult>(
      async (transaction) => {
        const [memberSnap, existingTx] = await Promise.all([
          transaction.get(memberRef),
          transaction.get(txRef),
        ]);

        if (!memberSnap.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }

        const member = memberSnap.data() ?? {};
        const currentPoints = Number(member.points ?? 0);
        const name =
          typeof member.name === "string" ? member.name : "GULA Member";
        const walletSerial =
          typeof member.walletSerial === "string"
            ? member.walletSerial
            : null;

        if (existingTx.exists) {
          const existing = existingTx.data() ?? {};
          return {
            duplicate: true,
            memberId,
            name,
            newPoints: Number(existing.newPoints ?? currentPoints),
            pointsEarned: Number(existing.pointsEarned ?? 0),
            walletSerial,
          };
        }

        const newPoints = currentPoints + pointsEarned;

        transaction.update(memberRef, {
          points: newPoints,
          lastUpdated: FieldValue.serverTimestamp(),
        });

        transaction.set(txRef, {
          memberId,
          spendAmount,
          spendCents,
          pointsEarned,
          previousPoints: currentPoints,
          newPoints,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          duplicate: false,
          memberId,
          name,
          newPoints,
          pointsEarned,
          walletSerial,
        };
      },
    );

    if (result.duplicate) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        memberId: result.memberId,
        memberName: result.name,
        pointsEarned: result.pointsEarned,
        newPoints: result.newPoints,
        walletSynced: true,
      });
    }

    const logoURL = new URL("/gula-wallet-logo.png", req.url).toString();

    let walletSynced = false;
    let replacementPassUrl: string | null = null;

    try {
      if (result.walletSerial) {
        const update = await updateWalletPass(result.walletSerial, {
          memberId: result.memberId,
          name: result.name,
          points: result.newPoints,
          logoURL,
        });

        if (update.ok) {
          walletSynced = true;

          await memberRef.update({
            walletLogoApplied: update.logoApplied,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        } else if (update.missing) {
          const replacement = await createWalletPass({
            memberId: result.memberId,
            name: result.name,
            points: result.newPoints,
            logoURL,
          });

          replacementPassUrl = replacement.shareUrl;

          await memberRef.update({
            walletSerial: replacement.serialNumber,
            passUrl: replacement.shareUrl,
            googleSaveUrl: replacement.googleSaveUrl,
            walletLogoApplied: replacement.logoApplied,
            lastUpdated: FieldValue.serverTimestamp(),
          });

          walletSynced = true;
        }
      } else {
        const replacement = await createWalletPass({
          memberId: result.memberId,
          name: result.name,
          points: result.newPoints,
          logoURL,
        });

        replacementPassUrl = replacement.shareUrl;

        await memberRef.update({
          walletSerial: replacement.serialNumber,
          passUrl: replacement.shareUrl,
          googleSaveUrl: replacement.googleSaveUrl,
          walletLogoApplied: replacement.logoApplied,
          lastUpdated: FieldValue.serverTimestamp(),
        });

        walletSynced = true;
      }
    } catch (walletError) {
      console.error("Wallet sync failed", walletError);
    }

    return NextResponse.json({
      success: true,
      duplicate: false,
      memberId: result.memberId,
      memberName: result.name,
      pointsEarned: result.pointsEarned,
      newPoints: result.newPoints,
      walletSynced,
      replacementPassUrl,
    });
  } catch (error: unknown) {
    console.error("add-points failed", error);

    if (getErrorMessage(error) === "MEMBER_NOT_FOUND") {
      return jsonError("Member not found. Check the QR code and try again.", 404);
    }

    return jsonError(getErrorMessage(error), 500);
  }
}
