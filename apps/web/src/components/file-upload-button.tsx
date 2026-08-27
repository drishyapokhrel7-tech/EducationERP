"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// Shared by every "paste a link" form this LMS work has built
// (course module items, class materials, assignment submissions) —
// storage itself is configurable server-side (LMS discovery slice 8);
// this component only ever sees the resulting url, same as if the
// caller had pasted an external link by hand.
export function FileUploadButton({
  onUploaded,
  label = "Upload a file",
}: {
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setUploading(true);
          try {
            const result = await api.uploadFile(file);
            onUploaded(result.url);
            toast.success("File uploaded");
          } catch {
            toast.error("Failed to upload file");
          } finally {
            setUploading(false);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : label}
      </Button>
    </>
  );
}
