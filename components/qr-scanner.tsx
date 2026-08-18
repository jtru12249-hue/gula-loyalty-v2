"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onScan: (memberId: string) => void | Promise<void>;
};

function cleanDecodedValue(value: string) {
  return value.trim().replace(/^gula:\/\/member\//i, "").slice(0, 200);
}

export default function QrScanner({ disabled = false, onScan }: Props) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const cameraActiveRef = useRef(false);
  const processingRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState(
    "Start the camera or upload a screenshot of the member pass.",
  );

  async function getScanner() {
    if (scannerRef.current) return scannerRef.current;

    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
      "html5-qrcode"
    );

    scannerRef.current = new Html5Qrcode("gula-qr-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });

    return scannerRef.current;
  }

  async function stopCamera() {
    const scanner = scannerRef.current;

    if (scanner && cameraActiveRef.current) {
      try {
        await scanner.stop();
      } catch {
        // Camera may already have stopped.
      }
    }

    cameraActiveRef.current = false;
    setCameraActive(false);
  }

  async function handleDecoded(decodedText: string) {
    if (processingRef.current || disabled) return;

    const memberId = cleanDecodedValue(decodedText);
    if (!memberId) {
      setMessage("That QR code is empty or invalid.");
      return;
    }

    processingRef.current = true;
    await stopCamera();
    setMessage("QR code read successfully.");

    try {
      await onScan(memberId);
    } finally {
      processingRef.current = false;
    }
  }

  async function startCamera() {
    if (disabled) return;

    try {
      setMessage("Requesting camera access…");
      await stopCamera();

      const scanner = await getScanner();

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(
              Math.min(viewfinderWidth, viewfinderHeight) * 0.72,
            );
            return { width: size, height: size };
          },
          aspectRatio: 1,
        },
        (decodedText) => {
          void handleDecoded(decodedText);
        },
        () => {
          // Normal frame misses are intentionally ignored.
        },
      );

      cameraActiveRef.current = true;
      setCameraActive(true);
      setMessage("Point the camera at the member QR code.");
    } catch (error) {
      console.error(error);
      cameraActiveRef.current = false;
      setCameraActive(false);
      setMessage(
        "Camera could not start. Check browser permission, use HTTPS, or upload a screenshot instead.",
      );
    }
  }

  async function scanFile(file: File) {
    if (disabled) return;

    try {
      setMessage("Reading QR code from image…");
      await stopCamera();

      const scanner = await getScanner();
      const decodedText = await scanner.scanFile(file, true);
      await handleDecoded(decodedText);
    } catch (error) {
      console.error(error);
      setMessage(
        "No QR code was found in that image. Try a sharper screenshot with the full QR visible.",
      );
    }
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (!scanner) return;

      if (cameraActiveRef.current) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            scanner.clear();
          });
      } else {
        scanner.clear();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black">
        <div
          id="gula-qr-reader"
          className="min-h-64 w-full [&_video]:rounded-2xl"
        />
      </div>

      <p className="min-h-6 text-sm text-neutral-400">{message}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={cameraActive ? stopCamera : startCamera}
          disabled={disabled}
          className="rounded-2xl bg-red-600 px-5 py-3.5 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cameraActive ? "Stop Camera" : "Scan with Camera"}
        </button>

        <label className="cursor-pointer rounded-2xl border border-white/15 bg-neutral-900 px-5 py-3.5 text-center font-semibold text-white transition hover:bg-neutral-800">
          Upload Screenshot
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void scanFile(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
