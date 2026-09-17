import { toast } from "sonner";
import { errorMessage } from "@/lib/submit-action";

// Fetch a Blob and save it as a file. Mirrors the pattern the
// analytics page had inline; shared so the finance invoice/receipt
// PDFs (and future document downloads) don't each re-roll it. Built on
// toast.promise — same "one call site gives a loading spinner *and* a
// completion toast" reasoning as lib/submit-action.ts's own
// submitAction, since server-side PDF/report generation is genuinely
// not instant and a plain click gave zero feedback while it ran.
export function downloadBlob(fetchBlob: () => Promise<Blob>, filename: string): void {
  toast.promise(
    fetchBlob().then((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    }),
    {
      loading: "Preparing download…",
      success: "Downloaded",
      error: (err) => errorMessage(err, "Download failed"),
    },
  );
}

// Fetch a Blob and open it in a new tab — for PDFs, this lands the
// viewer in the browser's own PDF reader, whose print button is the
// "browser print view" without needing a separate HTML route. The
// object URL is left for the browser to reclaim when the tab closes.
export function openBlobInNewTab(fetchBlob: () => Promise<Blob>): void {
  toast.promise(
    fetchBlob().then((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    }),
    {
      loading: "Preparing document…",
      success: "Opened in a new tab",
      error: (err) => errorMessage(err, "Could not open document"),
    },
  );
}
