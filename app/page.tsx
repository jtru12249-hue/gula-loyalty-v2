"use client";

import { FormEvent, useState } from "react";
import QrScanner from "@/components/qr-scanner";

type AddPointsResponse = {
  success?: boolean;
  error?: string;
  duplicate?: boolean;
  memberName?: string;
  pointsEarned?: number;
  newPoints?: number;
  walletSynced?: boolean;
};

export default function StaffTerminalPage() {
  const [staffPin, setStaffPin] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle"; text: string }
    | { type: "success" | "error"; text: string }
  >({
    type: "idle",
    text: "Enter the order total, then scan the customer's GULA Rewards QR code.",
  });

  async function awardPoints(memberId: string) {
    const amount = Number(spendAmount);

    if (!staffPin.trim()) {
      setStatus({
        type: "error",
        text: "Enter the staff PIN before scanning.",
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({
        type: "error",
        text: "Enter a valid order total before scanning.",
      });
      return;
    }

    setWorking(true);
    setStatus({
      type: "idle",
      text: "Adding points and syncing the customer pass…",
    });

    try {
      const res = await fetch("/api/add-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-pin": staffPin,
        },
        body: JSON.stringify({
          memberId,
          spendAmount: amount,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const data = (await res.json()) as AddPointsResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to add points.");
      }

      const syncText = data.walletSynced
        ? " Wallet updated successfully."
        : " Points were saved, but Wallet sync is temporarily unavailable.";

      setStatus({
        type: "success",
        text: `${data.memberName ?? "Member"} earned ${data.pointsEarned ?? 0} points. New balance: ${data.newPoints ?? 0}.${syncText}`,
      });

      setSpendAmount("");
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
      });
    } finally {
      setWorking(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  const expectedPoints =
    Number(spendAmount) > 0
      ? Math.floor(Math.round(Number(spendAmount) * 100) / 10)
      : 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-red-950/30">
                <img
                  src="/gula-logo.png"
                  alt="GULA EXPRESS logo"
                  width="80"
                  height="80"
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-red-500">
                  GULA EXPRESS
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  Staff Loyalty Terminal
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Fast checkout. Instant rewards.
                </p>
              </div>
            </div>

            <a
              href="/join"
              className="rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-bold text-neutral-200 transition hover:border-red-500/50 hover:bg-red-500/10"
            >
              Customer Join Page
            </a>
          </div>

          <div className="h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-orange-500" />
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-500">
              Step 1
            </p>
            <h2 className="mt-2 text-xl font-black">Enter sale details</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add the order amount before scanning.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Order total
                </span>
                <div className="flex items-center rounded-2xl border border-white/10 bg-neutral-900 px-4 transition focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10">
                  <span className="text-xl font-black text-neutral-500">$</span>
                  <input
                    type="number"
                    min="0.10"
                    max="10000"
                    step="0.01"
                    inputMode="decimal"
                    value={spendAmount}
                    onChange={(event) => setSpendAmount(event.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent px-2 py-4 text-2xl font-black outline-none placeholder:text-neutral-700"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Staff PIN
                </span>
                <input
                  type="password"
                  value={staffPin}
                  onChange={(event) => setStaffPin(event.target.value)}
                  placeholder="Enter staff PIN"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 font-bold outline-none transition placeholder:text-neutral-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                />
              </label>
            </form>

            <div className="mt-6 rounded-2xl border border-red-500/15 bg-red-500/[0.05] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
                Expected points
              </p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-4xl font-black">{expectedPoints}</p>
                <span className="pb-1 text-sm font-semibold text-neutral-500">
                  pts
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                $1 spent = 10 points
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-red-950/20 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-500">
                Step 2
              </p>
              <h2 className="mt-2 text-xl font-black">Scan member QR</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Scan the QR from Apple Wallet, Google Wallet, or an uploaded
                screenshot.
              </p>
            </div>

            <QrScanner disabled={working} onScan={awardPoints} />
          </section>
        </div>

        <div
          role="status"
          className={[
            "mt-6 rounded-[1.5rem] border p-5 text-sm font-medium leading-6",
            status.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : status.type === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-white/10 bg-neutral-950 text-neutral-400",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <span
              className={[
                "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                status.type === "success"
                  ? "bg-emerald-400"
                  : status.type === "error"
                    ? "bg-red-400"
                    : "bg-neutral-600",
              ].join(" ")}
            />
            <span>
              {working ? "Processing: " : ""}
              {status.text}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
