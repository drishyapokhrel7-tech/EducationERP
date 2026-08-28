"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import type { CameraEventResult } from "@education-erp/api-client";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

async function submitAction(action: () => Promise<unknown>, onSuccess: () => void) {
  try {
    await action();
    onSuccess();
    toast.success("Saved");
  } catch (err) {
    toast.error(errorMessage(err, "Failed"));
  }
}

// A camera is "healthy" if it's posted a capture recently — generous
// enough to tolerate any real capture client's interval (the Electron
// station's own default is 15s) with slack, while still meaning
// something. Computed on read, not stored — same reasoning as
// syllabus_progress.
const HEALTHY_WITHIN_MS = 2 * 60 * 1000;

// Date.now() can't be called directly in a component body (an impure
// read during render) — this hook is the pure way to let a component
// react to "the current time" by keeping it in state, updated on an
// interval rather than read fresh on every render.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CameraHealthBadge({ lastSeenAt, now }: { lastSeenAt: string | null; now: number }) {
  if (!lastSeenAt) return <Badge variant="secondary">Never seen</Badge>;
  const healthy = now - new Date(lastSeenAt).getTime() < HEALTHY_WITHIN_MS;
  return healthy ? (
    <Badge variant="success">Online</Badge>
  ) : (
    <Badge variant="warning">Stale — last seen {new Date(lastSeenAt).toLocaleString()}</Badge>
  );
}

function MatchSummary({ m }: { m: CameraEventResult["matches"][number] }) {
  const who = m.matchedEnrollment?.student
    ? `${m.matchedEnrollment.student.firstName} ${m.matchedEnrollment.student.lastName}`
    : m.matchedEnrollment?.staff
      ? `${m.matchedEnrollment.staff.firstName} ${m.matchedEnrollment.staff.lastName}`
      : "unknown person";
  const reconciled = m.reconciledStudentAttendanceId
    ? "→ attendance marked"
    : m.reconciledStaffAttendanceId
      ? "→ staff attendance marked"
      : null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={statusVariant(m.result)}>{m.result}</Badge>
      <span>
        {who} ({(m.confidence * 100).toFixed(1)}%){reconciled ? ` ${reconciled}` : ""}
      </span>
    </span>
  );
}

function MatchImage({ matchId }: { matchId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    api
      .getFaceMatchImage(matchId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [matchId]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Kept capture for review" className="h-24 w-24 rounded object-cover" />;
}

export default function CamerasPage() {
  const cameras = useSWR("cameras", () => api.listCameras());
  const matchEvents = useSWR("face-match-events", () => api.listFaceMatchEvents());
  const now = useNow(30_000);

  const [cameraForm, setCameraForm] = useState({ name: "", location: "" });
  const [captureCameraId, setCaptureCameraId] = useState("");
  const [captureResult, setCaptureResult] = useState<CameraEventResult | null>(null);

  const pendingReview = (matchEvents.data ?? []).filter((m) => m.result === "POSSIBLE_MATCH" && !m.reviewedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cameras</h1>
        <p className="text-muted-foreground text-sm">
          Register a camera, then test it by uploading a photo — this runs through the same match
          pipeline a real camera capture would use.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered cameras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!cameras.data || cameras.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cameras registered yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {cameras.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  {c.name}
                  {c.location ? ` — ${c.location}` : ""} ({c.adapterType})
                  <CameraHealthBadge lastSeenAt={c.lastSeenAt} now={now} />
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createCamera({ name: cameraForm.name, location: cameraForm.location || undefined }),
                () => {
                  setCameraForm({ name: "", location: "" });
                  cameras.mutate();
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input value={cameraForm.name} onChange={(e) => setCameraForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Location (optional)</Label>
              <Input
                value={cameraForm.location}
                onChange={(e) => setCameraForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <Button type="submit" size="sm" disabled={!cameraForm.name}>
              Add camera
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulate a capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
            }}
          >
            <div className="space-y-2">
              <Label className="text-xs">Camera</Label>
              <NativeSelect
                className="w-56"
                placeholder="Select camera"
                value={captureCameraId}
                onChange={setCaptureCameraId}
                options={(cameras.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Image</Label>
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                disabled={!captureCameraId}
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (!file || !captureCameraId) return;
                  submitAction(
                    async () => {
                      const result = await api.ingestCameraEvent(captureCameraId, file);
                      setCaptureResult(result);
                    },
                    () => matchEvents.mutate(),
                  );
                  ev.target.value = "";
                }}
              />
            </div>
          </form>
          {captureResult ? (
            <div className="text-sm">
              <p className="font-medium">Result:</p>
              {captureResult.matches.length === 0 ? (
                <p className="text-muted-foreground">No faces detected in that image.</p>
              ) : (
                <ul className="space-y-1">
                  {captureResult.matches.map((m) => (
                    <li key={m.id}>
                      <MatchSummary m={m} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingReview.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing awaiting review.</p>
          ) : (
            <ul className="space-y-3">
              {pendingReview.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <MatchImage matchId={m.id} />
                  <MatchSummary m={m} />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        submitAction(
                          () => api.reviewFaceMatch(m.id, { decision: "CONFIRMED" }),
                          () => matchEvents.mutate(),
                        )
                      }
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        submitAction(
                          () => api.reviewFaceMatch(m.id, { decision: "REJECTED" }),
                          () => matchEvents.mutate(),
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
