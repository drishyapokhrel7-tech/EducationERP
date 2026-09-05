import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EDITION_DISPLAY_NAME, FEATURE_MIN_EDITION, meetsEdition } from "@/lib/edition-features";
import { useEditionStatus } from "@/lib/use-edition-status";

// "Visible but locked" — the nav link to a gated page always renders
// (unchanged), but the page's own content is replaced with this
// upgrade notice when the org's edition doesn't meet the feature's
// minimum. Not a 403, not a hidden route — an org can see what a
// higher tier unlocks. Backend enforcement is a deliberate follow-up,
// not this slice (see the plan's "explicitly not in this slice") — an
// org's own valid session could still reach the underlying API
// directly; this is a UI-level experience, not a security boundary.
export function FeatureLock({
  feature,
  children,
}: {
  feature: keyof typeof FEATURE_MIN_EDITION;
  children: ReactNode;
}) {
  const { minEdition, label } = FEATURE_MIN_EDITION[feature];
  const status = useEditionStatus();

  // Loading — say nothing rather than flash the locked state before
  // the real check resolves.
  if (!status.data) return null;
  if (meetsEdition(status.data.edition, minEdition)) return <>{children}</>;

  const aboutUrl = process.env.NEXT_PUBLIC_OVEXA_ABOUT_URL ?? "https://ovexa.org/about";
  return (
    <Card className="mx-auto mt-8 max-w-md">
      <CardHeader className="items-center text-center">
        <div className="bg-primary/10 text-primary mb-2 flex size-12 items-center justify-center rounded-full">
          <Lock className="size-6" />
        </div>
        <CardTitle>
          {label} requires {EDITION_DISPLAY_NAME[minEdition]}
        </CardTitle>
        <CardDescription>
          This feature isn&apos;t included in your current plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-center">
        <Link href="/dashboard/billing" className={buttonVariants({ size: "sm" })}>
          Upgrade now
        </Link>
        <p>
          <a
            href={aboutUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-sm underline underline-offset-4"
          >
            Or contact Ovexa Technology
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
