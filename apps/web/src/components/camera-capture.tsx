"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Generic getUserMedia video preview + a "Capture" button. Same
// mechanics as components/library/face-capture.tsx (that one is
// scoped to librarysystem's staff-issue/member-enrollment flows and
// also returns a base64 string those callers need); this version is
// the general-purpose one for any "take a photo" need — currently the
// Student/Staff entry-form photo field (Phase 8 notifications-bullet
// adjacent gap-check: "why staff/student entry has no picture module
// with camera/upload option"). Always paired by the caller with a
// plain file-upload fallback — a denied/unavailable camera degrades
// to that, never a dead end, matching this project's existing camera
// UX precedent.
//
// Captures a still frame and freezes on it (a plain <img>, camera
// stream stopped) instead of leaving the live feed running behind an
// unchanged "Capture"→"Recapture" button label — previously nothing
// visibly happened when you pressed Capture, so there was no way to
// tell what you'd actually captured until the caller's upload
// finished. The frozen frame is the confirmation; "Recapture"
// restarts the live stream to try again.
export function CameraCapture({ onCapture }: { onCapture: (result: { blob: Blob }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mirrors frozenUrl state — read by the unmount cleanup below so it
  // can revoke without needing to call setFrozenUrl during teardown.
  const frozenUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);

  function startCamera() {
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Could not access a camera — check this browser's camera permission, or upload a file instead."));
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    // Deferred to a microtask so startCamera's own setState calls
    // (setError, and setStreamState indirectly via the ref) don't run
    // synchronously within the effect body itself — same restructuring
    // already used by CaptchaField's own load effect, same
    // react-hooks/set-state-in-effect reasoning.
    void Promise.resolve().then(startCamera);
    return () => {
      stopCamera();
      if (frozenUrlRef.current) URL.revokeObjectURL(frozenUrlRef.current);
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    stopCamera();
    if (frozenUrlRef.current) URL.revokeObjectURL(frozenUrlRef.current);
    const url = URL.createObjectURL(blob);
    frozenUrlRef.current = url;
    setFrozenUrl(url);
    onCapture({ blob });
  }

  function recapture() {
    if (frozenUrlRef.current) URL.revokeObjectURL(frozenUrlRef.current);
    frozenUrlRef.current = null;
    setFrozenUrl(null);
    startCamera();
  }

  if (error) {
    return <p className="text-destructive text-xs">{error}</p>;
  }

  return (
    <div className="space-y-2">
      {frozenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not a next/image-optimizable asset
        <img src={frozenUrl} alt="Captured preview" className="h-32 w-44 rounded border object-cover" />
      ) : (
        <video ref={videoRef} autoPlay muted playsInline className="h-32 w-44 rounded border bg-black object-cover" />
      )}
      <canvas ref={canvasRef} className="hidden" />
      {frozenUrl ? (
        <Button type="button" size="sm" variant="outline" onClick={recapture}>
          Recapture
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={capture}>
          Capture
        </Button>
      )}
    </div>
  );
}
