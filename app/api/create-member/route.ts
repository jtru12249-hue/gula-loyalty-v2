import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
} from "@/lib/validation";
import { createWalletPass } from "@/lib/walletwallet";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let memberRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const body = await req.json();
    const name = normalizeName(body?.name);
    const email = normalizeEmail(body?.email);

    if (name.length < 2) {
      return jsonError("Please enter your name.");
    }

    if (!isValidEmail(email)) {
      return jsonError("Please enter a valid email address.");
    }

    memberRef = adminDb.collection("members").doc();

    await memberRef.set({
      name,
      email,
      points: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp(),
      walletSerial: null,
      passUrl: null,
    });

    const memberId = memberRef.id;

    // Use the current deployed website as the public host for the logo.
    const logoURL = new URL("/gula-wallet-logo.png", req.url).toString();

    const wallet = await createWalletPass({
      memberId,
      name,
      points: 0,
      logoURL,
    });

    await memberRef.update({
      walletSerial: wallet.serialNumber,
      passUrl: wallet.shareUrl,
      googleSaveUrl: wallet.googleSaveUrl,
      walletLogoApplied: wallet.logoApplied,
      lastUpdated: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      memberId,
      passUrl: wallet.shareUrl,
      walletLogoApplied: wallet.logoApplied,
    });
  } catch (error: unknown) {
    if (memberRef) {
      await memberRef.delete().catch(() => undefined);
    }

    console.error("create-member failed", error);
    return jsonError(getErrorMessage(error), 500);
  }
}
