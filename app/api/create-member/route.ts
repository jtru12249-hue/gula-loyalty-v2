import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { getErrorMessage, jsonError } from "@/lib/http";
import {
  NEW_MEMBER_REFERRAL_BONUS,
  REFERRER_BONUS,
  isValidReferralCode,
  normalizeReferralCode,
  referralCodeForMember,
  safeReferralCode,
} from "@/lib/referrals";
import { safePoints } from "@/lib/rewards";
import {
  isValidEmail,
  isValidName,
  normalizeEmail,
  normalizeName,
} from "@/lib/validation";
import { createWalletPass, updateWalletPass } from "@/lib/walletwallet";

export const runtime = "nodejs";

function emailKey(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

async function ensureReferralCode(
  memberRef: FirebaseFirestore.DocumentReference,
  existingCode?: unknown,
) {
  const oldCode = safeReferralCode(existingCode);

  if (oldCode) {
    const codeRef = adminDb.collection("referralCodes").doc(oldCode);
    await adminDb.runTransaction(async (transaction) => {
      const codeSnap = await transaction.get(codeRef);
      const owner = codeSnap.exists ? String(codeSnap.data()?.memberId ?? "") : "";

      if (owner && owner !== memberRef.id) {
        throw new Error("REFERRAL_CODE_COLLISION");
      }

      transaction.set(
        codeRef,
        {
          memberId: memberRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return oldCode;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = referralCodeForMember(memberRef.id, attempt);
    const codeRef = adminDb.collection("referralCodes").doc(candidate);

    try {
      await adminDb.runTransaction(async (transaction) => {
        const codeSnap = await transaction.get(codeRef);
        const owner = codeSnap.exists ? String(codeSnap.data()?.memberId ?? "") : "";
        if (owner && owner !== memberRef.id) {
          throw new Error("REFERRAL_CODE_COLLISION");
        }

        transaction.set(codeRef, {
          memberId: memberRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.set(
          memberRef,
          {
            referralCode: candidate,
            lastUpdated: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
      return candidate;
    } catch (error) {
      if (getErrorMessage(error) !== "REFERRAL_CODE_COLLISION") throw error;
    }
  }

  throw new Error("COULD_NOT_CREATE_REFERRAL_CODE");
}

async function returnExistingMember(
  req: Request,
  doc: FirebaseFirestore.DocumentSnapshot,
  fallbackName: string,
  normalizedEmail: string,
) {
  if (!doc.exists) throw new Error("MEMBER_NOT_FOUND");

  const data = doc.data() ?? {};
  const name =
    typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallbackName;
  const points = safePoints(data.points);
  const referralCode = await ensureReferralCode(doc.ref, data.referralCode);
  const logoURL = new URL("/gula-wallet-logo.png", req.url).toString();

  let passUrl = typeof data.passUrl === "string" ? data.passUrl : null;
  const walletSerial =
    typeof data.walletSerial === "string" && data.walletSerial.trim()
      ? data.walletSerial
      : null;

  try {
    if (walletSerial) {
      const update = await updateWalletPass(walletSerial, {
        memberId: doc.id,
        name,
        points,
        referralCode,
        logoURL,
      });

      if (!update.ok) {
        const wallet = await createWalletPass({
          memberId: doc.id,
          name,
          points,
          referralCode,
          logoURL,
        });
        passUrl = wallet.shareUrl;
        await doc.ref.set(
          {
            walletSerial: wallet.serialNumber,
            passUrl: wallet.shareUrl,
            googleSaveUrl: wallet.googleSaveUrl,
            walletLogoApplied: wallet.logoApplied,
            lastUpdated: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    } else {
      const wallet = await createWalletPass({
        memberId: doc.id,
        name,
        points,
        referralCode,
        logoURL,
      });
      passUrl = wallet.shareUrl;
      await doc.ref.set(
        {
          walletSerial: wallet.serialNumber,
          passUrl: wallet.shareUrl,
          googleSaveUrl: wallet.googleSaveUrl,
          walletLogoApplied: wallet.logoApplied,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (error) {
    console.error("Could not sync existing member wallet", error);
  }

  await doc.ref.set(
    {
      normalizedEmail,
      referralCode,
      lastUpdated: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await adminDb.collection("memberEmails").doc(emailKey(normalizedEmail)).set(
    {
      memberId: doc.id,
      normalizedEmail,
      updatedAt: FieldValue.serverTimestamp(),
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

type SignupResult = {
  existingMemberId: string | null;
  ownReferralCode: string | null;
  startingPoints: number;
  referrerId: string | null;
  referrerWalletSerial: string | null;
  referrerName: string;
  referrerNewPoints: number | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = normalizeName(body?.name);
    const email = normalizeEmail(body?.email);
    const enteredReferralCode = normalizeReferralCode(body?.referralCode);

    if (!isValidName(name)) return jsonError("Please enter your name.");
    if (!isValidEmail(email)) return jsonError("Please enter a valid email address.");
    if (enteredReferralCode && !isValidReferralCode(enteredReferralCode)) {
      return jsonError("That referral code is not valid. Check the code or leave the field blank.");
    }

    const normalizedEmail = email;

    // Migrate legacy members before relying on the new unique-email index.
    const existingQuery = await adminDb
      .collection("members")
      .where("normalizedEmail", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return returnExistingMember(req, existingQuery.docs[0], name, normalizedEmail);
    }

    const oldQuery = await adminDb.collection("members").where("email", "==", email).limit(1).get();
    if (!oldQuery.empty) {
      return returnExistingMember(req, oldQuery.docs[0], name, normalizedEmail);
    }

    const newMemberRef = adminDb.collection("members").doc();
    const emailRef = adminDb.collection("memberEmails").doc(emailKey(normalizedEmail));
    const referralInputRef = enteredReferralCode
      ? adminDb.collection("referralCodes").doc(enteredReferralCode)
      : null;

    let signupResult: SignupResult | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const ownReferralCode = referralCodeForMember(newMemberRef.id, attempt);
      const ownReferralRef = adminDb.collection("referralCodes").doc(ownReferralCode);

      try {
        signupResult = await adminDb.runTransaction<SignupResult>(async (transaction) => {
          // Firestore requires transaction reads before writes.
          const emailSnap = await transaction.get(emailRef);
          if (emailSnap.exists) {
            const existingMemberId = String(emailSnap.data()?.memberId ?? "");
            if (!existingMemberId) throw new Error("INVALID_EMAIL_INDEX");
            return {
              existingMemberId,
              ownReferralCode: null,
              startingPoints: 0,
              referrerId: null,
              referrerWalletSerial: null,
              referrerName: "GULA Member",
              referrerNewPoints: null,
            };
          }

          const ownReferralSnap = await transaction.get(ownReferralRef);
          if (ownReferralSnap.exists) throw new Error("REFERRAL_CODE_COLLISION");

          let referrerRef: FirebaseFirestore.DocumentReference | null = null;
          let referrerSnap: FirebaseFirestore.DocumentSnapshot | null = null;

          if (referralInputRef) {
            const referralSnap = await transaction.get(referralInputRef);
            if (!referralSnap.exists) throw new Error("INVALID_REFERRAL");

            const referrerId = String(referralSnap.data()?.memberId ?? "");
            if (!referrerId) throw new Error("INVALID_REFERRAL");

            referrerRef = adminDb.collection("members").doc(referrerId);
            referrerSnap = await transaction.get(referrerRef);
            if (!referrerSnap.exists) throw new Error("INVALID_REFERRAL");
          }

          const startingPoints = referralInputRef ? NEW_MEMBER_REFERRAL_BONUS : 0;
          let referrerWalletSerial: string | null = null;
          let referrerName = "GULA Member";
          let referrerNewPoints: number | null = null;

          if (referrerRef && referrerSnap) {
            const referrer = referrerSnap.data() ?? {};
            const previousPoints = safePoints(referrer.points);
            referrerNewPoints = previousPoints + REFERRER_BONUS;
            referrerName =
              typeof referrer.name === "string" && referrer.name.trim()
                ? referrer.name.trim()
                : "GULA Member";
            referrerWalletSerial =
              typeof referrer.walletSerial === "string" ? referrer.walletSerial : null;

            transaction.update(referrerRef, {
              points: referrerNewPoints,
              referralCount: FieldValue.increment(1),
              referralPointsEarned: FieldValue.increment(REFERRER_BONUS),
              lastUpdated: FieldValue.serverTimestamp(),
            });

            transaction.set(adminDb.collection("pointTransactions").doc(), {
              memberId: referrerRef.id,
              type: "referral_reward",
              pointsEarned: REFERRER_BONUS,
              previousPoints,
              newPoints: referrerNewPoints,
              referredMemberId: newMemberRef.id,
              referralCodeUsed: enteredReferralCode,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          transaction.set(newMemberRef, {
            name,
            email,
            normalizedEmail,
            points: startingPoints,
            referralCode: ownReferralCode,
            referredBy: enteredReferralCode || null,
            referralBonusReceived: Boolean(enteredReferralCode),
            createdAt: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
            walletSerial: null,
            passUrl: null,
            googleSaveUrl: null,
          });

          transaction.set(emailRef, {
            memberId: newMemberRef.id,
            normalizedEmail,
            createdAt: FieldValue.serverTimestamp(),
          });

          transaction.set(ownReferralRef, {
            memberId: newMemberRef.id,
            createdAt: FieldValue.serverTimestamp(),
          });

          if (enteredReferralCode) {
            transaction.set(adminDb.collection("pointTransactions").doc(), {
              memberId: newMemberRef.id,
              type: "referral_signup",
              pointsEarned: NEW_MEMBER_REFERRAL_BONUS,
              previousPoints: 0,
              newPoints: NEW_MEMBER_REFERRAL_BONUS,
              referralCodeUsed: enteredReferralCode,
              referredByMemberId: referrerRef?.id ?? null,
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          return {
            existingMemberId: null,
            ownReferralCode,
            startingPoints,
            referrerId: referrerRef?.id ?? null,
            referrerWalletSerial,
            referrerName,
            referrerNewPoints,
          };
        });
        break;
      } catch (error) {
        if (getErrorMessage(error) !== "REFERRAL_CODE_COLLISION") throw error;
      }
    }

    if (!signupResult) throw new Error("COULD_NOT_CREATE_REFERRAL_CODE");

    if (signupResult.existingMemberId) {
      const existing = await adminDb.collection("members").doc(signupResult.existingMemberId).get();
      return returnExistingMember(req, existing, name, normalizedEmail);
    }

    const ownReferralCode = signupResult.ownReferralCode;
    if (!ownReferralCode) throw new Error("COULD_NOT_CREATE_REFERRAL_CODE");

    const logoURL = new URL("/gula-wallet-logo.png", req.url).toString();
    let passUrl: string | null = null;
    let walletLogoApplied = false;

    try {
      const wallet = await createWalletPass({
        memberId: newMemberRef.id,
        name,
        points: signupResult.startingPoints,
        referralCode: ownReferralCode,
        logoURL,
      });

      passUrl = wallet.shareUrl;
      walletLogoApplied = wallet.logoApplied;
      await newMemberRef.update({
        walletSerial: wallet.serialNumber,
        passUrl: wallet.shareUrl,
        googleSaveUrl: wallet.googleSaveUrl,
        walletLogoApplied: wallet.logoApplied,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    } catch (walletError) {
      // Membership creation should survive a temporary third-party Wallet outage.
      console.error("New member wallet creation failed", walletError);
    }

    if (
      signupResult.referrerId &&
      signupResult.referrerWalletSerial &&
      signupResult.referrerNewPoints !== null
    ) {
      try {
        const referrerRef = adminDb.collection("members").doc(signupResult.referrerId);
        const referrerSnap = await referrerRef.get();
        const referrerData = referrerSnap.data() ?? {};

        await updateWalletPass(signupResult.referrerWalletSerial, {
          memberId: signupResult.referrerId,
          name: signupResult.referrerName,
          points: signupResult.referrerNewPoints,
          referralCode: safeReferralCode(referrerData.referralCode) ?? undefined,
          logoURL,
        });
      } catch (walletError) {
        console.error("Referral wallet update failed", walletError);
      }
    }

    return NextResponse.json({
      success: true,
      existingMember: false,
      memberId: newMemberRef.id,
      name,
      points: signupResult.startingPoints,
      referralCode: ownReferralCode,
      referralApplied: Boolean(enteredReferralCode),
      referralBonus: enteredReferralCode ? NEW_MEMBER_REFERRAL_BONUS : 0,
      passUrl,
      walletLogoApplied,
      walletPending: !passUrl,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("create-member failed", error);

    if (message === "INVALID_REFERRAL") {
      return jsonError("That referral code is not valid. Check the code or leave the field blank.", 400);
    }

    if (message === "REFERRAL_CODE_COLLISION" || message === "COULD_NOT_CREATE_REFERRAL_CODE") {
      return jsonError("We could not create your referral code. Please try again.", 503);
    }

    return jsonError("We couldn't create your GULA Rewards account. Please try again.", 500);
  }
}
