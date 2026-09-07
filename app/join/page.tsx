"use client";

import { FormEvent, useState } from "react";

type Language = "en" | "es";

type JoinResponse = {
  success?: boolean;
  error?: string;
  memberId?: string;
  passUrl?: string;

  existingMember?: boolean;
  name?: string;
  points?: number;

  referralCode?: string;
  referralApplied?: boolean;
  referralBonus?: number;
};

const translations = {
  en: {
    language: "Español",

    brandSubtitle: "Eat. Earn. Repeat.",

    heroTitle: "Your next reward starts here.",

    heroDescription:
      "Join GULA Rewards, save your digital loyalty pass to Apple Wallet or Google Wallet, and earn points every time you order.",

    step1Label: "STEP 1",
    step1Title: "Join",
    step1Text: "Create your free GULA Rewards membership.",

    step2Label: "STEP 2",
    step2Title: "Scan",
    step2Text: "Show your Wallet QR code at checkout.",

    step3Label: "STEP 3",
    step3Title: "Earn",
    step3Text: "Get 10 points for every $1 spent.",

    rewardsLabel: "GULA REWARDS",

    formTitle: "Create your loyalty pass.",

    formSubtitle: "It takes less than a minute.",

    name: "Name",
    namePlaceholder: "Your name",

    email: "Email",
    emailPlaceholder: "you@example.com",

    referral: "Referral Code (optional)",
    referralPlaceholder: "GULA-XXXXXXXX",

    referralHelp:
      "Have a friend's code? Use it to start with 300 points. Your friend gets 400 points.",

    submit: "Create My GULA Pass",

    submitting: "Checking your membership...",

    rewardsRate: "Rewards Rate",

    rewardsValue: "$1 = 10 points",

    readyTitle: "Your GULA Rewards pass is ready.",

    readyDescription:
      "Add it to your phone and show the QR code every time you order.",

    welcomeBackTitle: "Welcome back to GULA Rewards!",

    welcomeBackDescription:
      "We found your existing membership. No duplicate account was created.",

    addWallet: "Add to Apple / Google Wallet",

    existingWallet: "Open My Existing Wallet Pass",

    startingBalance: "Starting Balance",

    currentBalance: "Current Balance",

    pointsWord: "points",

    referralBonusApplied:
      "Referral bonus applied! You started with 300 points.",

    yourReferralCode: "Your Referral Code",

    referralShareText:
      "Share this code with friends. They get 300 points when they join, and you get 400 points.",

    copyCode: "Copy Code",

    copied: "Copied!",

    another: "Use Another Email",

    staff: "Staff Terminal",

    genericError: "Something went wrong. Please try again.",
  },

  es: {
    language: "English",

    brandSubtitle: "Come. Gana. Repite.",

    heroTitle: "Tu próxima recompensa comienza aquí.",

    heroDescription:
      "Únete a GULA Rewards, guarda tu pase digital en Apple Wallet o Google Wallet y gana puntos cada vez que hagas una compra.",

    step1Label: "PASO 1",
    step1Title: "Regístrate",
    step1Text: "Crea gratis tu membresía de GULA Rewards.",

    step2Label: "PASO 2",
    step2Title: "Escanea",
    step2Text: "Muestra el código QR de tu Wallet al pagar.",

    step3Label: "PASO 3",
    step3Title: "Gana puntos",
    step3Text: "Recibe 10 puntos por cada $1 que gastes.",

    rewardsLabel: "GULA REWARDS",

    formTitle: "Crea tu pase de lealtad.",

    formSubtitle: "Toma menos de un minuto.",

    name: "Nombre",
    namePlaceholder: "Tu nombre",

    email: "Correo electrónico",
    emailPlaceholder: "tu@email.com",

    referral: "Código de referido (opcional)",
    referralPlaceholder: "GULA-XXXXXXXX",

    referralHelp:
      "¿Tienes el código de un amigo? Úsalo para comenzar con 300 puntos. Tu amigo recibe 400 puntos.",

    submit: "Crear Mi Pase GULA",

    submitting: "Buscando tu membresía...",

    rewardsRate: "Puntos",

    rewardsValue: "$1 = 10 puntos",

    readyTitle: "Tu pase de GULA Rewards está listo.",

    readyDescription:
      "Agrégalo a tu teléfono y muestra el código QR cada vez que hagas una compra.",

    welcomeBackTitle: "¡Bienvenido de nuevo a GULA Rewards!",

    welcomeBackDescription:
      "Encontramos tu membresía existente. No se creó una cuenta duplicada.",

    addWallet: "Agregar a Apple / Google Wallet",

    existingWallet: "Abrir Mi Pase Existente",

    startingBalance: "Balance Inicial",

    currentBalance: "Balance Actual",

    pointsWord: "puntos",

    referralBonusApplied:
      "¡Bono de referido aplicado! Comenzaste con 300 puntos.",

    yourReferralCode: "Tu Código de Referido",

    referralShareText:
      "Comparte este código con tus amigos. Ellos reciben 300 puntos cuando se registren y tú recibes 400 puntos.",

    copyCode: "Copiar Código",

    copied: "¡Copiado!",

    another: "Usar Otro Correo",

    staff: "Terminal de Empleados",

    genericError: "Algo salió mal. Inténtalo nuevamente.",
  },
};

export default function JoinPage() {
  const [language, setLanguage] = useState<Language>("en");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [working, setWorking] = useState(false);

  const [result, setResult] =
    useState<JoinResponse | null>(null);

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const t = translations[language];

  function toggleLanguage() {
    setLanguage((current) =>
      current === "en" ? "es" : "en",
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setWorking(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch(
        "/api/create-member",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name,
            email,
            referralCode,
          }),
        },
      );

      const data =
        (await res.json()) as JoinResponse;

      if (
        !res.ok ||
        !data.success ||
        !data.passUrl
      ) {
        throw new Error(
          data.error || t.genericError,
        );
      }

      setResult(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t.genericError,
      );
    } finally {
      setWorking(false);
    }
  }

  async function copyReferralCode() {
    if (!result?.referralCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        result.referralCode,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  const displayedPoints =
    typeof result?.points === "number"
      ? result.points
      : 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full">

          {/* LANGUAGE BUTTON */}
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition hover:border-red-500/50 hover:bg-red-500/10"
            >
              🌐 {t.language}
            </button>
          </div>

          <div className="grid w-full overflow-hidden rounded-[2.25rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-red-950/30 lg:grid-cols-[1.05fr_0.95fr]">

            {/* LEFT SIDE */}
            <section className="relative overflow-hidden border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <div className="pointer-events-none absolute -left-36 -top-36 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-5">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl shadow-red-950/50 sm:h-32 sm:w-32">
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

                    <p className="mt-2 text-sm font-semibold text-neutral-400">
                      {t.brandSubtitle}
                    </p>
                  </div>
                </div>

                <h1 className="mt-8 max-w-xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                  {t.heroTitle}
                </h1>

                <p className="mt-5 max-w-lg text-base leading-7 text-neutral-400">
                  {t.heroDescription}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                      {t.step1Label}
                    </span>

                    <p className="mt-3 text-lg font-black">
                      {t.step1Title}
                    </p>

                    <p className="mt-1 text-sm leading-5 text-neutral-500">
                      {t.step1Text}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                      {t.step2Label}
                    </span>

                    <p className="mt-3 text-lg font-black">
                      {t.step2Title}
                    </p>

                    <p className="mt-1 text-sm leading-5 text-neutral-500">
                      {t.step2Text}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                      {t.step3Label}
                    </span>

                    <p className="mt-3 text-lg font-black">
                      {t.step3Title}
                    </p>

                    <p className="mt-1 text-sm leading-5 text-neutral-500">
                      {t.step3Text}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* RIGHT SIDE */}
            <section className="p-7 sm:p-10">
              {!result ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-500">
                    {t.rewardsLabel}
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    {t.formTitle}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {t.formSubtitle}
                  </p>

                  <form
                    onSubmit={submit}
                    className="mt-7 space-y-5"
                  >
                    {/* NAME */}
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-neutral-300">
                        {t.name}
                      </span>

                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        autoComplete="name"
                        value={name}
                        onChange={(event) =>
                          setName(event.target.value)
                        }
                        placeholder={t.namePlaceholder}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      />
                    </label>

                    {/* EMAIL */}
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-neutral-300">
                        {t.email}
                      </span>

                      <input
                        required
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder={t.emailPlaceholder}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      />
                    </label>

                    {/* REFERRAL CODE */}
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-neutral-300">
                        {t.referral}
                      </span>

                      <input
                        maxLength={40}
                        autoComplete="off"
                        value={referralCode}
                        onChange={(event) =>
                          setReferralCode(
                            event.target.value.toUpperCase(),
                          )
                        }
                        placeholder={t.referralPlaceholder}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-4 font-mono uppercase tracking-wider outline-none transition placeholder:text-neutral-600 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      />

                      <span className="mt-2 block text-xs leading-5 text-neutral-600">
                        {t.referralHelp}
                      </span>
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
                      {working
                        ? t.submitting
                        : t.submit}
                    </button>
                  </form>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-neutral-500">
                        {t.rewardsRate}
                      </span>

                      <span className="font-black text-white">
                        {t.rewardsValue}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col justify-center">
                  <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl shadow-red-950/50">
                    <img
                      src="/gula-wallet-logo.png"
                      alt="GULA EXPRESS"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div
                    className={
                      result.existingMember
                        ? "mt-7 rounded-3xl border border-orange-500/25 bg-orange-500/10 p-5 text-center"
                        : "mt-7 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center"
                    }
                  >
                    <p
                      className={
                        result.existingMember
                          ? "text-lg font-black text-orange-200"
                          : "text-lg font-black text-emerald-200"
                      }
                    >
                      {result.existingMember
                        ? t.welcomeBackTitle
                        : t.readyTitle}
                    </p>

                    <p
                      className={
                        result.existingMember
                          ? "mt-2 text-sm leading-6 text-orange-100/70"
                          : "mt-2 text-sm leading-6 text-emerald-100/70"
                      }
                    >
                      {result.existingMember
                        ? t.welcomeBackDescription
                        : t.readyDescription}
                    </p>
                  </div>

                  {/* REFERRAL BONUS SUCCESS */}
                  {result.referralApplied ? (
                    <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center text-sm font-bold text-emerald-200">
                      {t.referralBonusApplied}
                    </div>
                  ) : null}

                  <a
                    href={result.passUrl}
                    className="mt-5 block w-full rounded-2xl bg-red-600 px-5 py-4 text-center font-black text-white shadow-lg shadow-red-950/40 transition hover:-translate-y-0.5 hover:bg-red-500"
                  >
                    {result.existingMember
                      ? t.existingWallet
                      : t.addWallet}
                  </a>

                  {/* POINT BALANCE */}
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs uppercase tracking-wider text-neutral-600">
                        {result.existingMember
                          ? t.currentBalance
                          : t.startingBalance}
                      </span>

                      <span className="font-black text-white">
                        {displayedPoints.toLocaleString()}{" "}
                        {t.pointsWord}
                      </span>
                    </div>
                  </div>

                  {/* MEMBER REFERRAL CODE */}
                  {result.referralCode ? (
                    <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                        {t.yourReferralCode}
                      </p>

                      <p className="mt-3 break-all font-mono text-xl font-black tracking-wider text-white">
                        {result.referralCode}
                      </p>

                      <p className="mt-3 text-xs leading-5 text-neutral-500">
                        {t.referralShareText}
                      </p>

                      <button
                        type="button"
                        onClick={copyReferralCode}
                        className="mt-4 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold transition hover:bg-white/10"
                      >
                        {copied
                          ? t.copied
                          : t.copyCode}
                      </button>
                    </div>
                  ) : null}

                  <p className="mt-4 break-all text-center text-xs text-neutral-700">
                    Member ID: {result.memberId}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setName("");
                      setEmail("");
                      setReferralCode("");
                      setCopied(false);
                      setResult(null);
                      setError("");
                    }}
                    className="mt-5 text-sm font-semibold text-neutral-500 transition hover:text-white"
                  >
                    {t.another}
                  </button>
                </div>
              )}

              <a
                href="/"
                className="mt-7 block text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600 transition hover:text-neutral-300"
              >
                {t.staff}
              </a>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
