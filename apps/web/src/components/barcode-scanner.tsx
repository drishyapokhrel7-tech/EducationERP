"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat, NotFoundException } from "@zxing/library";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

type FacingMode = "environment" | "user";

// Restricted to the formats an ISBN is actually printed as (EAN-13 on
// virtually every modern book, EAN-8/UPC-A/UPC-E on older or
// non-standard editions) — narrower than BrowserMultiFormatReader's
// default of every format it knows, which cuts down on false
// positives from unrelated barcodes in frame.
const ISBN_HINTS = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);

// Live camera preview that continuously decodes a barcode and reports
// the first one found — same "environment by default, flip if more
// than one camera exists" reasoning as CameraCapture, but built on
// zxing's own continuous-decode loop (decodeFromConstraints) instead
// of CameraCapture's still-frame capture, since a barcode scan needs
// every frame analyzed rather than one frame the user manually
// triggers.
export function BarcodeScanner({
  onDetected,
  defaultFacingMode = "environment",
}: {
  onDetected: (code: string) => void;
  defaultFacingMode?: FacingMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>(defaultFacingMode);
  const [canFlip, setCanFlip] = useState(false);

  function stopScanning() {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }

  function startScanning(mode: FacingMode) {
    setError(null);
    stopScanning();
    const reader = readerRef.current ?? new BrowserMultiFormatReader(ISBN_HINTS);
    readerRef.current = reader;
    if (!videoRef.current) return;
    reader
      .decodeFromConstraints({ video: { facingMode: mode } }, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (result) {
          controls.stop();
          onDetected(result.getText());
          return;
        }
        // NotFoundException fires on every frame with no barcode in
        // view — the normal "still scanning" state, not a real error.
        if (err && !(err instanceof NotFoundException)) {
          setError("Barcode scan failed — try again, or type the ISBN in manually.");
        }
      })
      .catch(() => setError("Could not access a camera — check this browser's camera permission, or type the ISBN in manually."));
  }

  useEffect(() => {
    void Promise.resolve().then(() => startScanning(defaultFacingMode));
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1))
      .catch(() => {});
    return () => stopScanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; flipCamera below restarts the stream explicitly
  }, []);

  function flipCamera() {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startScanning(next);
  }

  if (error) {
    return <p className="text-destructive text-xs">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} muted playsInline className="h-40 w-64 rounded border bg-black object-cover" />
      <p className="text-muted-foreground text-xs">Point the camera at the book&apos;s ISBN barcode.</p>
      {canFlip ? (
        <Button type="button" size="sm" variant="outline" onClick={flipCamera}>
          Flip camera
        </Button>
      ) : null}
    </div>
  );
}
