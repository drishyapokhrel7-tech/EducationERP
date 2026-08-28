"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUploadButton } from "@/components/file-upload-button";
import { CameraCapture } from "@/components/camera-capture";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";

// A reasonable cap for an identification-style photo — generous
// enough for any real phone/webcam capture, tight enough to block an
// accidental huge-file upload (a full-res scan, a video misclicked as
// an image, ...).
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// A camera capture no longer uploads the moment it's taken — it used
// to, which meant every recapture fired its own network round trip
// before the admin could even see what they'd shot. Now the capture
// just becomes a local preview (this "pending" state); the actual
// upload is deferred to resolvePhotoUrl() below, called once by the
// form's own submit handler alongside the rest of the record's data.
// A file picked via FileUploadButton still uploads immediately —
// there's no live-preview-to-freeze concern for a file already on
// disk, so there's nothing to gain by deferring that path too.
export type PhotoValue =
  | { status: "empty" }
  | { status: "uploaded"; url: string }
  | { status: "pending"; file: File; previewUrl: string };

export const EMPTY_PHOTO: PhotoValue = { status: "empty" };

export function photoValueUrl(value: PhotoValue): string | null {
  if (value.status === "uploaded") return value.url;
  if (value.status === "pending") return value.previewUrl;
  return null;
}

export function hasPhoto(value: PhotoValue): boolean {
  return value.status !== "empty";
}

// Called once, at form-submit time — uploads a pending capture now and
// returns the resulting URL; a file-picker upload already has one and
// passes straight through.
export async function resolvePhotoUrl(value: PhotoValue): Promise<string> {
  if (value.status === "uploaded") return value.url;
  if (value.status === "pending") {
    const result = await api.uploadFile(value.file);
    return result.url;
  }
  throw new Error("No photo selected");
}

// The Student/Staff entry forms' photo field — an optional
// identification photo, distinct from Phase 6's consent-gated
// biometric FaceEnrollment photo (see Student.photoUrl's schema
// comment). Reuses the generic upload endpoint (FileUploadButton, LMS
// discovery slice 8) for a plain file, and the generic
// getUserMedia-based CameraCapture for a live snapshot — both paths
// converge on a PhotoValue the form resolves to a photoUrl at submit
// time via resolvePhotoUrl().
export function PhotoInput({ value, onChange }: { value: PhotoValue; onChange: (next: PhotoValue) => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const previewSrc = photoValueUrl(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Avatar src={previewSrc} size="lg" />
        <div className="flex flex-col gap-1">
          <FileUploadButton
            label={previewSrc ? "Replace photo" : "Upload photo"}
            accept="image/*"
            maxSizeBytes={MAX_PHOTO_BYTES}
            onUploaded={(url) => {
              onChange({ status: "uploaded", url });
              setShowCamera(false);
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setShowCamera((s) => !s)}>
            {showCamera ? "Cancel camera" : "Use camera"}
          </Button>
        </div>
      </div>
      {showCamera ? (
        <CameraCapture
          onCapture={({ blob }) => {
            const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
            onChange({ status: "pending", file, previewUrl: URL.createObjectURL(file) });
          }}
        />
      ) : null}
    </div>
  );
}
