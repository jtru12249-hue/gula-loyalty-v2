"use client";

import { FormEvent, useState } from "react";

type JoinResponse = {
  success?: boolean;
  error?: string;
  memberId?: string;
  passUrl?: string;
};

export default function JoinPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<JoinResponse | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = (await res.json()) as JoinResponse;

      if (!res.ok || !data.success || !data.passUrl) {
        throw new Error(data.error || "Unable to create your GULA pass.");
      }

      setResult(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-[2rem] border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-red-950/20 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">
            GULA EXPRESS
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">
            Get rewarded every visit.
          </h1>
          <p className="mt-3 text-neutral-400">
            Join GULA Rewards, save your pass to Apple Wallet or Google Wallet,
            and earn 10 points for every $1 spent.
          </p>

          {!result ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-300">
                  Name
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none placeholder:text-neutral-600 focus:border-red-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-300">
                  Email
                </span>
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none placeholder:text-neutral-600 focus:border-red-500"
                />
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={working}
                className="w-full rounded-2xl bg-red-600 px-5 py-4 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? "Creating your pass…" : "Join GULA Rewards"}
              </button>
            </form>
          ) : (
            <div className="mt-8 space-y-4">
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <p className="font-bold text-emerald-200">
                  Your GULA Rewards pass is ready.
                </p>
                <p className="mt-1 text-sm text-emerald-200/70">
                  Add it to your phone now and show the QR code when you order.
                </p>
              </div>

              <a
                href={result.passUrl}
                className="block w-full rounded-2xl bg-red-600 px-5 py-4 text-center font-bold text-white transition hover:bg-red-500"
              >
                Add to Wallet
              </a>

              <p className="break-all text-center text-xs text-neutral-600">
                Member ID: {result.memberId}
              </p>
            </div>
          )}

          <a
            href="/"
            className="mt-6 block text-center text-sm text-neutral-500 hover:text-neutral-300"
          >
            Staff terminal
          </a>
        </section>
      </div>
    </main>
  );
}
