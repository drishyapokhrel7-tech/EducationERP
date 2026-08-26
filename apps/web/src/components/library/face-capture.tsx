"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export interface FaceCaptureResult {
  base64: string; // raw base64, no "data:image/jpeg;base64," prefix — what faceImageBase64 fields expect
  blob: Blob; // same image as a Blob, for multipart uploads (e.g. enrollFaceTemplate)
}

// getUserMedia video preview + a "Capture" button, shared by the staff
// issue/return flow and member face-template enrollment. Always paired
// by the caller with a manual-override fallback — a denied/unavailable
// camera degrades to that, never a dead end, matching librarysystem's
// own "face verification is never blocking" design (see
// docs/LIBRARY_SYSTEM_INTEGRATION_NOTES.md).
export function FaceCapture({ onCapture }: { onCapture: (result: FaceCaptureResult) => void }) {
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
      .catch(() => setError("Could not access a camera — check this browser's camera permission, or use manual override instead."));
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    setCaptured(true);
    onCapture({ base64: dataUrl.split(",")[1] ?? "", blob });
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
