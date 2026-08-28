"use client";

import { useState } from "react";
import { toast } from "sonner";
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

// The Student/Staff entry forms' photo field — an optional
// identification photo, distinct from Phase 6's consent-gated
// biometric FaceEnrollment photo (see Student.photoUrl's schema
// comment). Reuses the generic upload endpoint (FileUploadButton, LMS
// discovery slice 8) for a plain file, and the generic
// getUserMedia-based CameraCapture for a live snapshot — both paths
// converge on the same `photoUrl` string the form submits.
export function PhotoInput({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Avatar src={value} size="lg" />
        <div className="flex flex-col gap-1">
          <FileUploadButton
            label={value ? "Replace photo" : "Upload photo"}
            accept="image/*"
            maxSizeBytes={MAX_PHOTO_BYTES}
            onUploaded={(url) => {
              onChange(url);
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
          onCapture={async ({ blob }) => {
            setUploading(true);
            try {
              const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
              const result = await api.uploadFile(file);
              onChange(result.url);
              setShowCamera(false);
              toast.success("Photo captured");
            } catch {
              toast.error("Failed to upload captured photo");
            } finally {
              setUploading(false);
            }
          }}
        />
      ) : null}
      {uploading ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}
    </div>
  );
}
