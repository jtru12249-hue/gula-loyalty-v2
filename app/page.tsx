"use client";

import { FormEvent, useState } from "react";
import QrScanner from "@/components/qr-scanner";

type Member = {
  memberId: string;
  name: string;
  points: number;
  rewardEligible: boolean;
  pointsToReward: number;
};

type MemberInfoResponse = {
  success?: boolean;
  error?: string;
  member?: Member;
};

type ActionResponse = {
  success?: boolean;
  error?: string;
  memberName?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  newPoints?: number;
  walletSynced?: boolean;
};

export default function StaffTerminalPage() {
  const [staffPin, setStaffPin] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [working, setWorking] = useState(false);

  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    text: string;
  }>({
    type: "idle",
    text: "Scan a customer pass. Scanning does not change their points.",
  });

  const amount = Number(spendAmount);

  const expectedPoints =
    Number.isFinite(amount) && amount > 0
      ? Math.floor(Math.round(amount * 100) / 10)
      : 0;

  const progress = member
    ? Math.min(100, (member.points / 1000) * 100)
    : 0;

  async function loadMember(memberId: string) {
    if (!staffPin.trim()) {
      setStatus({
        type: "error",
        text: "Enter the staff PIN before scanning.",
      });

      return;
    }

    setLoadingMember(true);
    setMember(null);

    setStatus({
      type: "idle",
      text: "Looking up member balance...",
    });

    try {
      const res = await fetch("/api/member-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-pin": staffPin,
        },
        body: JSON.stringify({
          memberId,
        }),
      });

      const data = (await res.json()) as MemberInfoResponse;

      if (!res.ok || !data.success || !data.member) {
        throw new Error(data.error || "Member not found.");
      }

      setMember(data.member);

      setStatus({
        type: "success",
        text: `${data.member.name} found. Current balance: ${data.member.points} points.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to find member.",
      });
    } finally {
      setLoadingMember(false);
    }
  }

  async function addPoints() {
    if (!member) return;

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({
        type: "error",
        text: "Enter a valid order total first.",
      });

      return;
    }

    setWorking(true);

    setStatus({
      type: "idle",
      text: "Adding points...",
    });

    try {
      const res = await fetch("/api/add-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-pin": staffPin,
        },
        body: JSON.stringify({
          memberId: member.memberId,
          spendAmount: amount,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const data = (await res.json()) as ActionResponse;

      if (
        !res.ok ||
        !data.success ||
        typeof data.newPoints !== "number"
      ) {
        throw new Error(data.error || "Unable to add points.");
      }

      const newPoints = data.newPoints;

      setMember({
        ...member,
        points: newPoints,
        rewardEligible: newPoints >= 1000,
        pointsToReward: Math.max(0, 1000 - newPoints),
      });

      setSpendAmount("");

      setStatus({
        type: "success",
        text: `${data.pointsEarned ?? expectedPoints} points added. ${member.name} now has ${newPoints} points.${
          data.walletSynced ? " Wallet updated." : ""
        }`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to add points.",
      });
    } finally {
      setWorking(false);
    }
  }

  async function redeemReward() {
    if (!member || member.points < 1000) return;

    const confirmed = window.confirm(
      `Redeem 1000 points from ${member.name}?\n\nCurrent balance: ${member.points}\nNew balance: ${member.points - 1000}`,
    );

    if (!confirmed) return;

    setWorking(true);

    setStatus({
      type: "idle",
      text: "Redeeming reward...",
    });

    try {
      const res = await fetch("/api/redeem-reward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-pin": staffPin,
        },
        body: JSON.stringify({
          memberId: member.memberId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const data = (await res.json()) as ActionResponse;

      if (
        !res.ok ||
        !data.success ||
        typeof data.newPoints !== "number"
      ) {
        throw new Error(
          data.error || "Unable to redeem reward.",
        );
      }

      const newPoints = data.newPoints;

      setMember({
        ...member,
        points: newPoints,
        rewardEligible: newPoints >= 1000,
        pointsToReward: Math.max(0, 1000 - newPoints),
      });

      setStatus({
        type: "success",
        text: `FREE REWARD REDEEMED! 1000 points deducted. ${member.name} now has ${newPoints} points.${
          data.walletSynced ? " Wallet updated." : ""
        }`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to redeem reward.",
      });
    } finally {
      setWorking(false);
    }
  }

  function clearMember() {
    setMember(null);
    setSpendAmount("");

    setStatus({
      type: "idle",
      text: "Ready for the next customer.",
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,.20),transparent_30rem)]" />

          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5">
                <img
                  src="/gula-wallet-logo.png"
                  alt="GULA EXPRESS"
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
                  GULA EXPRESS
                </p>

                <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                  Rewards Terminal
                </h1>

                <p className="mt-1 text-sm text-neutral-500">
                  Scan. Review. Confirm.
                </p>
              </div>
            </div>

            <a
              href="/join"
              className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-bold hover:bg-white/5"
            >
              Customer Join Page
            </a>
          </div>

          <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-orange-500" />
        </header>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.05fr_0.9fr]">
          {/* SALE */}
          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Step 1
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Sale Details
            </h2>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Enter the order total. Points are only added
              after you press the button.
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-6 space-y-5"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-300">
                  Order Total
                </span>

                <div className="flex items-center rounded-2xl border border-white/10 bg-neutral-900 px-4 focus-within:border-red-500">
                  <span className="text-xl font-black text-neutral-500">
                    $
                  </span>

                  <input
                    type="number"
                    min="0.10"
                    max="10000"
                    step="0.01"
                    value={spendAmount}
                    onChange={(event) =>
                      setSpendAmount(event.target.value)
                    }
                    placeholder="0.00"
                    className="w-full bg-transparent px-2 py-4 text-3xl font-black outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-300">
                  Staff PIN
                </span>

                <input
                  type="password"
                  value={staffPin}
                  onChange={(event) =>
                    setStaffPin(event.target.value)
                  }
                  placeholder="Enter staff PIN"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 font-bold outline-none focus:border-red-500"
                />
              </label>
            </form>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                Points to Add
              </p>

              <p className="mt-2 text-4xl font-black">
                {expectedPoints}

                <span className="ml-2 text-base text-neutral-500">
                  pts
                </span>
              </p>

              <p className="mt-2 text-xs text-neutral-600">
                $1 = 10 points
              </p>
            </div>
          </section>

          {/* SCANNER */}
          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Step 2
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Scan Member
            </h2>

            <p className="mt-2 mb-5 text-sm leading-6 text-neutral-500">
              Scanning only identifies the customer. It does
              not add points automatically.
            </p>

            <QrScanner
              disabled={working || loadingMember}
              onScan={loadMember}
            />

            {loadingMember && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-400">
                Loading member...
              </div>
            )}
          </section>

          {/* MEMBER */}
          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
              Step 3
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Member & Actions
            </h2>

            {!member ? (
              <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-white/10 bg-black/30 p-8 text-center">
                <div className="mb-5 text-5xl">◇</div>

                <p className="font-black text-neutral-300">
                  No member scanned
                </p>

                <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-600">
                  Scan a GULA Wallet QR code to see the
                  customer's balance.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40">
                  <div
                    className={
                      member.rewardEligible
                        ? "bg-gradient-to-br from-emerald-500/15 to-transparent p-5"
                        : "p-5"
                    }
                  >
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                      Member
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                      {member.name}
                    </h3>

                    <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
                      Current Balance
                    </p>

                    <p className="mt-1 text-5xl font-black">
                      {member.points.toLocaleString()}

                      <span className="ml-2 text-base text-neutral-500">
                        pts
                      </span>
                    </p>
                  </div>

                  <div className="border-t border-white/10 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-neutral-400">
                        Free Reward
                      </span>

                      <span
                        className={
                          member.rewardEligible
                            ? "font-black text-emerald-400"
                            : "font-black text-white"
                        }
                      >
                        {member.rewardEligible
                          ? "READY!"
                          : `${member.pointsToReward} pts away`}
                      </span>
                    </div>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 transition-all"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-neutral-600">
                      <span>0</span>
                      <span>1,000</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addPoints}
                  disabled={
                    working ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                  }
                  className="w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ADD {expectedPoints} POINTS
                </button>

                <button
                  type="button"
                  onClick={redeemReward}
                  disabled={
                    working || !member.rewardEligible
                  }
                  className={
                    member.rewardEligible
                      ? "w-full rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-4 font-black text-emerald-300 transition hover:bg-emerald-500/25"
                      : "w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 font-black text-neutral-700"
                  }
                >
                  {member.rewardEligible
                    ? "🎁 REDEEM FREE REWARD — 1000 PTS"
                    : "🔒 FREE REWARD — 1000 PTS"}
                </button>

                <button
                  type="button"
                  onClick={clearMember}
                  disabled={working}
                  className="w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-500 hover:bg-white/5 hover:text-white"
                >
                  Clear / Next Customer
                </button>
              </div>
            )}
          </section>
        </div>

        <div
          className={
            status.type === "success"
              ? "mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm font-semibold text-emerald-200"
              : status.type === "error"
                ? "mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm font-semibold text-red-200"
                : "mt-6 rounded-2xl border border-white/10 bg-neutral-950 p-5 text-sm font-semibold text-neutral-400"
          }
        >
          {status.text}
        </div>
      </div>
    </main>
  );
}
