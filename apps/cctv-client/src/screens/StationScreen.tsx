import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraEventResult, FaceMatchEvent, SafeUser } from "@education-erp/api-client";

// A fixed default rather than an elaborate config surface — the plan's
// own deliberate scope call. Real enough to be an actual gate-camera
// cadence, not a live video stream (that's explicitly not what this
// slice builds).
const CAPTURE_INTERVAL_MS = 15_000;

export function StationScreen({
  cameraId,
  user,
  onReconfigure,
  onLogout,
}: {
  cameraId: string;
  user: SafeUser | null;
  onReconfigure: () => void;
  onLogout: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastCaptureAt, setLastCaptureAt] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<CameraEventResult | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [events, setEvents] = useState<FaceMatchEvent[] | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCameraError("Could not access a local camera — check this app's OS camera permission."));
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const refreshEvents = useCallback(() => {
    window.cctvClient.listRecentEvents().then(setEvents);
  }, []);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const captureAndSubmit = useCallback(async () => {
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
    const buffer = await blob.arrayBuffer();
    try {
      const result = await window.cctvClient.submitFrame(cameraId, {
        buffer,
        filename: `capture-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
      });
      setLastResult(result);
      setLastCaptureAt(new Date());
      setCaptureError(null);
      refreshEvents();
    } catch {
      // The next interval retries — no queued backfill of a missed
      // capture, matching the plan's "resilient-online, not true
      // offline" scope for this slice.
      setCaptureError("Last capture failed to upload — retrying next interval.");
    }
  }, [cameraId, refreshEvents]);

  useEffect(() => {
    const timer = setInterval(() => void captureAndSubmit(), CAPTURE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [captureAndSubmit]);

  const pendingReview = (events ?? []).filter((e) => e.result === "POSSIBLE_MATCH" && !e.reviewedAt);

  return (
    <div className="screen station">
      <header>
        <h1>Station active</h1>
        {user ? (
          <span className="muted">
            Signed in as {user.firstName} {user.lastName}
          </span>
        ) : null}
        <div className="header-actions">
          <button type="button" className="link-button" onClick={onReconfigure}>
            Change camera
          </button>
          <button type="button" className="link-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="station-grid">
        <section className="card">
          <h2>Local preview</h2>
          {cameraError ? <p className="error">{cameraError}</p> : null}
          <video ref={videoRef} autoPlay muted playsInline />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <p className="muted">
            {lastCaptureAt ? `Last capture: ${lastCaptureAt.toLocaleTimeString()}` : "Waiting for first capture…"}
          </p>
          {captureError ? <p className="error">{captureError}</p> : null}
          {lastResult ? (
            <ul className="result-list">
              {lastResult.matches.length === 0 ? (
                <li className="muted">No faces detected in the last capture.</li>
              ) : (
                lastResult.matches.map((m) => (
                  <li key={m.id}>
                    {m.result} ({(m.confidence * 100).toFixed(0)}%)
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </section>

        <section className="card">
          <h2>Review queue</h2>
          {pendingReview.length === 0 ? (
            <p className="muted">Nothing awaiting review.</p>
          ) : (
            <ul className="event-list">
              {pendingReview.map((e) => (
                <ReviewItem key={e.id} event={e} onReviewed={refreshEvents} />
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Recent events</h2>
          {!events || events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            <ul className="event-list">
              {events.slice(0, 20).map((e) => (
                <li key={e.id}>
                  {e.result} — {describeMatch(e)} ({(e.confidence * 100).toFixed(0)}%)
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function describeMatch(event: FaceMatchEvent): string {
  if (event.matchedEnrollment?.student) {
    return `${event.matchedEnrollment.student.firstName} ${event.matchedEnrollment.student.lastName}`;
  }
  if (event.matchedEnrollment?.staff) {
    return `${event.matchedEnrollment.staff.firstName} ${event.matchedEnrollment.staff.lastName}`;
  }
  return "unknown person";
}

function ReviewItem({ event, onReviewed }: { event: FaceMatchEvent; onReviewed: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    window.cctvClient
      .getEventImage(event.id)
      .then(({ buffer, mimeType }) => {
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
        setImageUrl(objectUrl);
      })
      .catch(() => setImageUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [event.id]);

  return (
    <li className="review-item">
      {imageUrl ? <img src={imageUrl} alt="Kept capture for review" /> : null}
      <span>
        {describeMatch(event)} ({(event.confidence * 100).toFixed(0)}%)
      </span>
      <div className="review-actions">
        <button
          type="button"
          onClick={() => window.cctvClient.reviewEvent(event.id, { decision: "CONFIRMED" }).then(onReviewed)}
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => window.cctvClient.reviewEvent(event.id, { decision: "REJECTED" }).then(onReviewed)}
        >
          Reject
        </button>
      </div>
    </li>
  );
}
