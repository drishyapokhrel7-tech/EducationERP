import type { Edition } from "@education-erp/api-client";
import { NEXT_EDITION_LABEL } from "@/lib/edition-features";

// Rendered by the Students/Staff create forms in place of the usual
// error toast when a create attempt returns the structured
// EDITION_LIMIT_EXCEEDED body (see EditionLimitExceededException).
export function EditionUpgradeBanner({ edition }: { edition: Edition }) {
  const aboutUrl = process.env.NEXT_PUBLIC_OVEXA_ABOUT_URL ?? "https://ovexa.com/about";
  return (
    <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
      Sorry, you need to upgrade your system to {NEXT_EDITION_LABEL[edition]}. Please contact{" "}
      <a href={aboutUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        Ovexa Technology
      </a>
      .
    </div>
  );
}
