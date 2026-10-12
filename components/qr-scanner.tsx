"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onScan: (memberId: string) => void | Promise<void>;
};

function decodeMemberId(raw: string) {
  const value = raw.trim().replace(/^gula:\/\/member\//i, "");
  return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

export default function QrScanner({ disabled = false, onScan }: Props) {
  const reactId = useId();
  const elementId = `gula-reader-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Scan a member pass or upload its QR screenshot.");

  async function scanner() {
    if (scannerRef.current) return scannerRef.current;
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    const instance = new Html5Qrcode(elementId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = instance;
    return instance;
  }

  async function stop() {
    if (scannerRef.current && runningRef.current) {
      runningRef.current = false;
      try { await scannerRef.current.stop(); } catch { /* already stopped */ }
    }
    if (mountedRef.current) setRunning(false);
  }

  async function decoded(raw: string) {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await stop();
      const id = decodeMemberId(raw);
      if (!id) {
        setMessage("This is not a valid GULA member QR code.");
        return;
      }
      setMessage("QR scanned. Looking up member…");
      await onScan(id);
      setMessage("Scan complete. You can scan another member.");
    } catch {
      setMessage("Could not look up this member. Please try again.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function start() {
    if (disabled || busyRef.current || runningRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      setMessage("Requesting camera permission…");
      const s = await scanner();
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => {
          const size = Math.max(100, Math.floor(Math.min(w, h) * 0.7));
          return { width: size, height: size };
        } },
        (value) => { void decoded(value); },
        () => undefined,
      );
      runningRef.current = true;
      if (mountedRef.current) {
        setRunning(true);
        setMessage("Point the camera at the member QR code.");
      }
    } catch {
      setMessage("Camera unavailable. Allow camera access on HTTPS or upload a screenshot.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function scanImage(file: File) {
    if (disabled || busyRef.current) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setMessage("Choose an image smaller than 10 MB.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await stop();
      const s = await scanner();
      const value = await s.scanFile(file, true);
      busyRef.current = false;
      await decoded(value);
    } catch {
      setMessage("No QR code found. Try a clear image showing the full QR.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const s = scannerRef.current;
      if (s) {
        if (runningRef.current) {
          void s.stop().catch(() => undefined).finally(() => { try { s.clear(); } catch {} });
        } else {
          try { s.clear(); } catch {}
        }
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
        <div id={elementId} className="min-h-64 w-full [&_video]:rounded-2xl" />
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-neutral-400">{message}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={disabled || busy} onClick={() => { void (running ? stop() : start()); }} className="rounded-2xl bg-red-600 px-5 py-3.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50">
          {running ? "Stop Camera" : "Scan with Camera"}
        </button>
        <label className={`rounded-2xl border border-white/15 bg-neutral-900 px-5 py-3.5 text-center font-semibold text-white ${disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-neutral-800"}`}>
          Upload Screenshot
          <input type="file" accept="image/*" className="hidden" disabled={disabled || busy} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void scanImage(file);
          }} />
        </label>
      </div>
    </div>
  );
}
