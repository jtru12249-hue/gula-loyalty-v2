import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";

import {
  NEW_MEMBER_REFERRAL_BONUS,
  REFERRER_BONUS,
  normalizeReferralCode,
  referralCodeForMember,
} from "@/lib/referrals";

import {
  isValidEmail,
  normalizeEmail,
  normalizeName,
} from "@/lib/validation";

import {
  createWalletPass,
  updateWalletPass,
} from "@/lib/walletwallet";

export const runtime = "nodejs";

async function ensureReferralCode(
  memberRef: FirebaseFirestore.DocumentReference,
  existingCode?: unknown,
) {
  const oldCode =
    normalizeReferralCode(existingCode);

  if (oldCode) {
    await adminDb
      .collection("referralCodes")
      .doc(oldCode)
      .set(
        {
          memberId: memberRef.id,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return oldCode;
  }

  const newCode =
    referralCodeForMember(memberRef.id);

  await adminDb
    .collection("referralCodes")
    .doc(newCode)
    .set({
      memberId: memberRef.id,
      createdAt:
        FieldValue.serverTimestamp(),
    });

  await memberRef.set(
    {
      referralCode: newCode,
      lastUpdated:
        FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return newCode;
}

async function returnExistingMember(
  req: Request,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  fallbackName: string,
  normalizedEmail: string,
) {
  const data = doc.data();

  const name =
    typeof data.name === "string"
      ? data.name
      : fallbackName;

  const points = Math.max(
    0,
    Number(data.points ?? 0),
  );

  const referralCode =
    await ensureReferralCode(
      doc.ref,
      data.referralCode,
    );

  const logoURL = new URL(
    "/gula-wallet-logo.png",
    req.url,
  ).toString();

  let passUrl =
    typeof data.passUrl === "string"
      ? data.passUrl
      : null;

  const walletSerial =
    typeof data.walletSerial === "string"
      ? data.walletSerial
      : null;

  /*
    Update their existing Wallet pass
    so older members also see their
    referral code.
  */
  if (walletSerial) {
    try {
      const update =
        await updateWalletPass(
          walletSerial,
          {
            memberId: doc.id,
            name,
            points,
            referralCode,
            logoURL,
          },
        );

      if (!update.ok) {
        const wallet =
          await createWalletPass({
            memberId: doc.id,
            name,
            points,
            referralCode,
            logoURL,
          });

        passUrl = wallet.shareUrl;

        await doc.ref.update({
          walletSerial:
            wallet.serialNumber,

          passUrl:
            wallet.shareUrl,

          googleSaveUrl:
            wallet.googleSaveUrl,

          walletLogoApplied:
            wallet.logoApplied,
        });
      }
    } catch (error) {
      console.error(
        "Could not update existing wallet",
        error,
      );
    }
  } else {
    const wallet =
      await createWalletPass({
        memberId: doc.id,
        name,
        points,
        referralCode,
        logoURL,
      });

    passUrl = wallet.shareUrl;

    await doc.ref.update({
      walletSerial:
        wallet.serialNumber,

      passUrl:
        wallet.shareUrl,

      googleSaveUrl:
        wallet.googleSaveUrl,

      walletLogoApplied:
        wallet.logoApplied,
    });
  }

  await doc.ref.set(
    {
      normalizedEmail,

      referralCode,

      lastUpdated:
        FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({
    success: true,

    existingMember: true,

    memberId: doc.id,

    name,

    points,

    referralCode,

    passUrl,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name =
      normalizeName(body?.name);

    const email =
      normalizeEmail(body?.email);

    const enteredReferralCode =
      normalizeReferralCode(
        body?.referralCode,
      );

    if (name.length < 2) {
      return jsonError(
        "Please enter your name.",
      );
    }

    if (!isValidEmail(email)) {
      return jsonError(
        "Please enter a valid email address.",
      );
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
      FIRST:
      Check if this email already has
      a GULA membership.
    */
    const existingQuery =
      await adminDb
        .collection("members")
        .where(
          "normalizedEmail",
          "==",
          normalizedEmail,
        )
        .limit(1)
        .get();

    if (!existingQuery.empty) {
      return returnExistingMember(
        req,
        existingQuery.docs[0],
        name,
        normalizedEmail,
      );
    }

    /*
      Check old customers who were
      created before normalizedEmail.
    */
    const oldQuery =
      await adminDb
        .collection("members")
        .where(
          "email",
          "==",
          email,
        )
        .limit(1)
        .get();

    if (!oldQuery.empty) {
      return returnExistingMember(
        req,
        oldQuery.docs[0],
        name,
        normalizedEmail,
      );
    }

    /*
      Validate referral code.
    */
    let referrerRef:
      FirebaseFirestore.DocumentReference
      | null = null;

    if (enteredReferralCode) {
      const referralSnap =
        await adminDb
          .collection("referralCodes")
          .doc(enteredReferralCode)
          .get();

      if (!referralSnap.exists) {
        return jsonError(
          "That referral code is not valid. Check the code or leave the field blank.",
          400,
        );
      }

      const referrerId =
        String(
          referralSnap.data()
            ?.memberId ?? "",
        );

      if (!referrerId) {
        return jsonError(
          "That referral code is not valid.",
          400,
        );
      }

      referrerRef =
        adminDb
          .collection("members")
          .doc(referrerId);

      const referrerSnap =
        await referrerRef.get();

      if (!referrerSnap.exists) {
        return jsonError(
          "That referral code is not valid.",
          400,
        );
      }
    }

    /*
      Create new member.
    */
    const newMemberRef =
      adminDb
        .collection("members")
        .doc();

    const memberId =
      newMemberRef.id;

    const ownReferralCode =
      referralCodeForMember(
        memberId,
      );

    const startingPoints =
      enteredReferralCode
        ? NEW_MEMBER_REFERRAL_BONUS
        : 0;

    let referrerWalletSerial:
      string | null = null;

    let referrerName =
      "GULA Member";

    let referrerNewPoints:
      number | null = null;

    /*
      Transaction keeps the referral
      bonus secure on the server.
    */
    await adminDb.runTransaction(
      async (transaction) => {
        if (referrerRef) {
          const referrerSnap =
            await transaction.get(
              referrerRef,
            );

          if (!referrerSnap.exists) {
            throw new Error(
              "Invalid referral.",
            );
          }

          const referrer =
            referrerSnap.data() ??
            {};

          const previousPoints =
            Math.max(
              0,
              Number(
                referrer.points ?? 0,
              ),
            );

          const newPoints =
            previousPoints +
            REFERRER_BONUS;

          referrerNewPoints =
            newPoints;

          referrerName =
            typeof referrer.name ===
              "string"
              ? referrer.name
              : "GULA Member";

          referrerWalletSerial =
            typeof referrer.walletSerial ===
              "string"
              ? referrer.walletSerial
              : null;

          transaction.update(
            referrerRef,
            {
              points:
                newPoints,

              referralCount:
                FieldValue.increment(
                  1,
                ),

              referralPointsEarned:
                FieldValue.increment(
                  REFERRER_BONUS,
                ),

              lastUpdated:
                FieldValue.serverTimestamp(),
            },
          );

          const referrerTransaction =
            adminDb
              .collection(
                "pointTransactions",
              )
              .doc();

          transaction.set(
            referrerTransaction,
            {
              memberId:
                referrerRef.id,

              type:
                "referral_reward",

              pointsEarned:
                REFERRER_BONUS,

              previousPoints,

              newPoints,

              referredMemberId:
                memberId,

              referralCodeUsed:
                enteredReferralCode,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );
        }

        transaction.set(
          newMemberRef,
          {
            name,

            email,

            normalizedEmail,

            points:
              startingPoints,

            referralCode:
              ownReferralCode,

            referredBy:
              enteredReferralCode ||
              null,

            referralBonusReceived:
              Boolean(
                enteredReferralCode,
              ),

            createdAt:
              FieldValue.serverTimestamp(),

            lastUpdated:
              FieldValue.serverTimestamp(),

            walletSerial:
              null,

            passUrl:
              null,

            googleSaveUrl:
              null,
          },
        );

        transaction.set(
          adminDb
            .collection(
              "referralCodes",
            )
            .doc(
              ownReferralCode,
            ),
          {
            memberId,

            createdAt:
              FieldValue.serverTimestamp(),
          },
        );

        /*
          Save +300 history for
          the new customer.
        */
        if (
          enteredReferralCode
        ) {
          const signupTransaction =
            adminDb
              .collection(
                "pointTransactions",
              )
              .doc();

          transaction.set(
            signupTransaction,
            {
              memberId,

              type:
                "referral_signup",

              pointsEarned:
                NEW_MEMBER_REFERRAL_BONUS,

              previousPoints:
                0,

              newPoints:
                NEW_MEMBER_REFERRAL_BONUS,

              referralCodeUsed:
                enteredReferralCode,

              referredByMemberId:
                referrerRef?.id ??
                null,

              createdAt:
                FieldValue.serverTimestamp(),
            },
          );
        }
      },
    );

    /*
      Create Wallet pass.
    */
    const logoURL =
      new URL(
        "/gula-wallet-logo.png",
        req.url,
      ).toString();

    const wallet =
      await createWalletPass({
        memberId,

        name,

        points:
          startingPoints,

        referralCode:
          ownReferralCode,

        logoURL,
      });

    await newMemberRef.update({
      walletSerial:
        wallet.serialNumber,

      passUrl:
        wallet.shareUrl,

      googleSaveUrl:
        wallet.googleSaveUrl,

      walletLogoApplied:
        wallet.logoApplied,

      lastUpdated:
        FieldValue.serverTimestamp(),
    });

    /*
      Update the person who referred
      them so their Wallet immediately
      shows the extra 400 points.
    */
    if (
      referrerRef &&
      referrerWalletSerial &&
      referrerNewPoints !== null
    ) {
      try {
        const referrerSnap =
          await referrerRef.get();

        const referrerData =
          referrerSnap.data() ??
          {};

        await updateWalletPass(
          referrerWalletSerial,
          {
            memberId:
              referrerRef.id,

            name:
              referrerName,

            points:
              referrerNewPoints,

            referralCode:
              typeof referrerData.referralCode ===
                "string"
                ? referrerData.referralCode
                : undefined,

            logoURL,
          },
        );
      } catch (error) {
        console.error(
          "Referral wallet update failed",
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,

      existingMember: false,

      memberId,

      name,

      points:
        startingPoints,

      referralCode:
        ownReferralCode,

      referralApplied:
        Boolean(
          enteredReferralCode,
        ),

      referralBonus:
        enteredReferralCode
          ? NEW_MEMBER_REFERRAL_BONUS
          : 0,

      passUrl:
        wallet.shareUrl,

      walletLogoApplied:
        wallet.logoApplied,
    });
  } catch (error) {
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
