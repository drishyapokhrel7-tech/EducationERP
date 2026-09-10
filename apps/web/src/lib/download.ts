import { toast } from "sonner";
import { errorMessage } from "@/lib/submit-action";

// Fetch a Blob and save it as a file. Mirrors the pattern the
// analytics page had inline; shared so the finance invoice/receipt
// PDFs (and future document downloads) don't each re-roll it.
export async function downloadBlob(fetchBlob: () => Promise<Blob>, filename: string): Promise<void> {
  try {
    const blob = await fetchBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(errorMessage(err, "Download failed"));
  }
}

// Fetch a Blob and open it in a new tab — for PDFs, this lands the
// viewer in the browser's own PDF reader, whose print button is the
// "browser print view" without needing a separate HTML route. The
// object URL is left for the browser to reclaim when the tab closes.
export async function openBlobInNewTab(fetchBlob: () => Promise<Blob>): Promise<void> {
  try {
    const blob = await fetchBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    toast.error(errorMessage(err, "Could not open document"));
  }
}
