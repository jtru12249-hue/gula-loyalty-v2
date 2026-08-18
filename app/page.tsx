"use client";

import Image from "next/image";
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
    setStatus({ type: "idle", text: "Adding points and syncing the pass…" });

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
        ? " The Wallet pass was synced."
        : " Points were saved, but the Wallet pass could not sync right now.";

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
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-neutral-950/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white p-1.5">
              <Image
                src="/gula-logo.png"
                alt="GULA logo"
                width={68}
                height={68}
                priority
                className="h-16 w-16 rounded-xl object-cover"
              />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-red-500">
                GULA EXPRESS
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Staff Loyalty Terminal
              </h1>
            </div>
          </div>

          <a
            href="/join"
            className="rounded-full border border-white/15 px-5 py-2.5 text-center text-sm font-bold text-neutral-200 transition hover:border-red-500/50 hover:bg-red-500/10"
          >
            Customer Join Page
          </a>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-600">
              Step 1
            </p>
            <h2 className="mt-2 text-xl font-black">Enter sale details</h2>

            <form onSubmit={onSubmit} className="mt-5 space-y-5">
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
                <p className="mt-2 text-xs text-neutral-600">
                  Customer earns 10 points per $1.
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-neutral-300">
                  Staff PIN
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={staffPin}
                  onChange={(event) => setStaffPin(event.target.value)}
                  placeholder="Enter staff PIN"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 font-bold outline-none transition placeholder:text-neutral-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                />
              </label>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-600">
                Expected points
              </p>
              <p className="mt-2 text-3xl font-black">
                {Number(spendAmount) > 0
                  ? Math.floor(Math.round(Number(spendAmount) * 100) / 10)
                  : 0}
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-red-950/20 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-600">
                Step 2
              </p>
              <h2 className="mt-2 text-xl font-black">Scan member QR</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                Use the live camera or upload a screenshot from the customer's
                Wallet pass.
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
