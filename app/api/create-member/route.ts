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
  let newMemberRef: FirebaseFirestore.DocumentReference | null = null;

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

    /*
      Normalize the email so:
      Customer@Email.com
      customer@email.com

      are treated as the same member.
    */
    const normalizedEmail = email.trim().toLowerCase();

    /*
      STEP 1:
      Check whether this email already belongs
      to an existing GULA member.
    */
    const existingQuery = await adminDb
      .collection("members")
      .where("normalizedEmail", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      const existingData = existingDoc.data();

      const memberId = existingDoc.id;

      const existingName =
        typeof existingData.name === "string"
          ? existingData.name
          : name;

      const existingPoints = Math.max(
        0,
        Number(existingData.points ?? 0),
      );

      const existingPassUrl =
        typeof existingData.passUrl === "string"
          ? existingData.passUrl
          : null;

      /*
        If the customer already has a pass,
        simply return it.
      */
      if (existingPassUrl) {
        return NextResponse.json({
          success: true,
          existingMember: true,
          memberId,
          name: existingName,
          points: existingPoints,
          passUrl: existingPassUrl,
        });
      }

      /*
        Older member exists, but no Wallet pass
        is stored.

        Recreate the Wallet pass using the SAME
        Firestore memberId.
      */
      const logoURL = new URL(
        "/gula-wallet-logo.png",
        req.url,
      ).toString();

      const wallet = await createWalletPass({
        memberId,
        name: existingName,
        points: existingPoints,
        logoURL,
      });

      await existingDoc.ref.update({
        walletSerial: wallet.serialNumber,
        passUrl: wallet.shareUrl,
        googleSaveUrl: wallet.googleSaveUrl,
        walletLogoApplied: wallet.logoApplied,
        normalizedEmail,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        existingMember: true,
        memberId,
        name: existingName,
        points: existingPoints,
        passUrl: wallet.shareUrl,
        walletLogoApplied: wallet.logoApplied,
      });
    }

    /*
      STEP 2:
      Compatibility check for members created
      before normalizedEmail existed.
    */
    const oldMemberQuery = await adminDb
      .collection("members")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!oldMemberQuery.empty) {
      const existingDoc = oldMemberQuery.docs[0];
      const existingData = existingDoc.data();

      const memberId = existingDoc.id;

      const existingName =
        typeof existingData.name === "string"
          ? existingData.name
          : name;

      const existingPoints = Math.max(
        0,
        Number(existingData.points ?? 0),
      );

      /*
        Upgrade this old member record so future
        duplicate checks are faster.
      */
      await existingDoc.ref.update({
        normalizedEmail,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      const existingPassUrl =
        typeof existingData.passUrl === "string"
          ? existingData.passUrl
          : null;

      if (existingPassUrl) {
        return NextResponse.json({
          success: true,
          existingMember: true,
          memberId,
          name: existingName,
          points: existingPoints,
          passUrl: existingPassUrl,
        });
      }

      const logoURL = new URL(
        "/gula-wallet-logo.png",
        req.url,
      ).toString();

      const wallet = await createWalletPass({
        memberId,
        name: existingName,
        points: existingPoints,
        logoURL,
      });

      await existingDoc.ref.update({
        walletSerial: wallet.serialNumber,
        passUrl: wallet.shareUrl,
        googleSaveUrl: wallet.googleSaveUrl,
        walletLogoApplied: wallet.logoApplied,
        lastUpdated: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        existingMember: true,
        memberId,
        name: existingName,
        points: existingPoints,
        passUrl: wallet.shareUrl,
        walletLogoApplied: wallet.logoApplied,
      });
    }

    /*
      STEP 3:
      No existing member found.

      Create a brand-new GULA member.
    */
    newMemberRef = adminDb
      .collection("members")
      .doc();

    await newMemberRef.set({
      name,
      email,
      normalizedEmail,

      points: 0,

      createdAt: FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp(),

      walletSerial: null,
      passUrl: null,
      googleSaveUrl: null,
    });

    const memberId = newMemberRef.id;

    const logoURL = new URL(
      "/gula-wallet-logo.png",
      req.url,
    ).toString();

    const wallet = await createWalletPass({
      memberId,
      name,
      points: 0,
      logoURL,
    });

    await newMemberRef.update({
      walletSerial: wallet.serialNumber,
      passUrl: wallet.shareUrl,
      googleSaveUrl: wallet.googleSaveUrl,
      walletLogoApplied: wallet.logoApplied,
      lastUpdated: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      existingMember: false,
      memberId,
      name,
      points: 0,
      passUrl: wallet.shareUrl,
      walletLogoApplied: wallet.logoApplied,
    });
  } catch (error: unknown) {
    /*
      Only delete the Firestore member if this
      request created a brand-new member and then
      failed before completing registration.

      Existing members are NEVER deleted.
    */
    if (newMemberRef) {
      await newMemberRef.delete().catch(() => undefined);
    }

    console.error(
      "create-member failed",
      error,
    );

    return jsonError(
      getErrorMessage(error),
      500,
    );
  }
}
