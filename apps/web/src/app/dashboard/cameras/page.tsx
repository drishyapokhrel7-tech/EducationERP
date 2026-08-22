"use client";

import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
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

function matchLabel(m: CameraEventResult["matches"][number]) {
  const who = m.matchedEnrollment?.student
    ? `${m.matchedEnrollment.student.firstName} ${m.matchedEnrollment.student.lastName}`
    : m.matchedEnrollment?.staff
      ? `${m.matchedEnrollment.staff.firstName} ${m.matchedEnrollment.staff.lastName}`
      : "unknown person";
  return `${m.result} — ${who} (${(m.confidence * 100).toFixed(1)}%)`;
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

  const [cameraForm, setCameraForm] = useState({ name: "", location: "" });
  const [captureCameraId, setCaptureCameraId] = useState("");
  const [captureResult, setCaptureResult] = useState<CameraEventResult | null>(null);

  const pendingReview = (matchEvents.data ?? []).filter((m) => m.result === "POSSIBLE_MATCH" && !m.reviewedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cameras</h1>
        <p className="text-muted-foreground text-sm">
          Phase 6 slice 6c — register a camera, then simulate a capture by uploading a photo (any image posted here
          exercises the same capture→match pipeline a real camera adapter will later use).
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
            <ul className="text-sm">
              {cameras.data.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.location ? ` — ${c.location}` : ""} ({c.adapterType})
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
                <ul>
                  {captureResult.matches.map((m) => (
                    <li key={m.id}>{matchLabel(m)}</li>
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
                  <span>{matchLabel(m)}</span>
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
