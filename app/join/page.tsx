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
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[2.25rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-red-950/30 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="pointer-events-none absolute -left-36 -top-36 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-5">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl shadow-red-950/50 sm:h-32 sm:w-32">
                  <img
                    src="/gula-logo.png"
                    alt="GULA EXPRESS logo"
                    width="128"
                    height="128"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-red-500">
                    GULA EXPRESS
                  </p>
                  <p className="mt-2 text-sm font-semibold text-neutral-400">
                    Eat. Earn. Repeat.
                  </p>
                </div>
              </div>

              <h1 className="mt-8 max-w-xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Your next reward starts here.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-neutral-400">
                Join GULA Rewards, save your digital loyalty pass to Apple
                Wallet or Google Wallet, and earn points every time you order.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["01", "Join", "Create your free membership."],
                  ["02", "Scan", "Show your QR at checkout."],
                  ["03", "Earn", "Get 10 points per $1."],
                ].map(([number, title, text]) => (
                  <div
                    key={number}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                  >
                    <span className="text-xs font-black text-red-500">
                      {number}
                    </span>
                    <p className="mt-2 font-black">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-neutral-500">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-7 sm:p-10">
            {!result ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-500">
                  GULA Rewards
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Create your loyalty pass.
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  It takes less than a minute.
                </p>

                <form onSubmit={submit} className="mt-7 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-neutral-300">
                      Name
                    </span>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-neutral-300">
                      Email
                    </span>
                    <input
                      required
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                    />
                  </label>

                  {error ? (
                    <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={working}
                    className="w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white shadow-lg shadow-red-950/40 transition hover:-translate-y-0.5 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Creating your pass…" : "Create My GULA Pass"}
                  </button>
                </form>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-neutral-500">
                      Rewards rate
                    </span>
                    <span className="font-black text-white">
                      $1 = 10 points
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl shadow-red-950/50">
                  <img
                    src="/gula-logo.png"
                    alt="GULA EXPRESS logo"
                    width="144"
                    height="144"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-7 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
                  <p className="text-lg font-black text-emerald-200">
                    Your GULA Rewards pass is ready.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                    Add it to your phone and show the QR code every time you
                    order.
                  </p>
                </div>

                <a
                  href={result.passUrl}
                  className="mt-5 block w-full rounded-2xl bg-red-600 px-5 py-4 text-center font-black text-white shadow-lg shadow-red-950/40 transition hover:-translate-y-0.5 hover:bg-red-500"
                >
                  Add to Apple / Google Wallet
                </a>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs uppercase tracking-wider text-neutral-600">
                      Starting balance
                    </span>
                    <span className="font-black text-white">0 points</span>
                  </div>
                </div>

                <p className="mt-4 break-all text-center text-xs text-neutral-700">
                  Member ID: {result.memberId}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setEmail("");
                    setResult(null);
                    setError("");
                  }}
                  className="mt-5 text-sm font-semibold text-neutral-500 transition hover:text-white"
                >
                  Create another membership
                </button>
              </div>
            )}

            <a
              href="/"
              className="mt-7 block text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600 transition hover:text-neutral-300"
            >
              Staff terminal
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
