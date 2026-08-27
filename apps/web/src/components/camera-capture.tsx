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
export function CameraCapture({ onCapture }: { onCapture: (result: { blob: Blob }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Could not access a camera — check this browser's camera permission, or upload a file instead."));
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
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
    setCaptured(true);
    onCapture({ blob });
  }

  if (error) {
    return <p className="text-destructive text-xs">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} autoPlay muted playsInline className="h-32 w-44 rounded border bg-black object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <Button type="button" size="sm" variant="outline" onClick={capture}>
        {captured ? "Recapture" : "Capture"}
      </Button>
    </div>
  );
}
