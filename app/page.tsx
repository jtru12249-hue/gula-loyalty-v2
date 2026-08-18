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
  replacementPassUrl?: string | null;
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
    text: "Enter the order total, then scan the customer's GULA pass.",
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
    setStatus({ type: "idle", text: "Adding points…" });

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

      const syncNote = data.walletSynced
        ? " Wallet updated."
        : " Points saved, but the Wallet pass could not sync right now.";

      setStatus({
        type: "success",
        text: `${data.memberName ?? "Member"} earned ${data.pointsEarned ?? 0} points. New balance: ${data.newPoints ?? 0}.${syncNote}`,
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

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">
              GULA EXPRESS
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Staff Loyalty Terminal
            </h1>
          </div>

          <a
            href="/join"
            className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/5"
          >
            Join Page
          </a>
        </header>

        <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-red-950/20 sm:p-7">
          <form onSubmit={onSubmit} className="mb-7 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-300">
                Order total
              </span>
              <div className="flex items-center rounded-2xl border border-white/10 bg-neutral-900 px-4 focus-within:border-red-500">
                <span className="text-neutral-500">$</span>
                <input
                  type="number"
                  min="0.10"
                  max="10000"
                  step="0.01"
                  inputMode="decimal"
                  value={spendAmount}
                  onChange={(event) => setSpendAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent px-2 py-4 text-xl font-bold outline-none placeholder:text-neutral-700"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-300">
                Staff PIN
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={staffPin}
                onChange={(event) => setStaffPin(event.target.value)}
                placeholder="••••••"
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 text-xl font-bold outline-none placeholder:text-neutral-700 focus:border-red-500"
              />
            </label>
          </form>

          <QrScanner disabled={working} onScan={awardPoints} />

          <div
            role="status"
            className={[
              "mt-6 rounded-2xl border p-4 text-sm leading-6",
              status.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : status.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-white/10 bg-white/[0.03] text-neutral-400",
            ].join(" ")}
          >
            {working ? "Processing… " : null}
            {status.text}
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-neutral-600">
            <span>$1 = 10 points</span>
            <span>Camera + screenshot scanning</span>
          </div>
        </section>
      </div>
    </main>
  );
}
