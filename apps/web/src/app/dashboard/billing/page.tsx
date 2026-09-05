"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/submit-action";
import { submitEsewaForm } from "@/lib/esewa";
import { useEditionStatus } from "@/lib/use-edition-status";
import { EDITION_PRICING_NPR, meetsEdition } from "@/lib/edition-features";
import type { Edition } from "@education-erp/api-client";

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

const PLANS: { edition: Edition; description: string }[] = [
  { edition: "PROFESSIONAL", description: "Finance, HR & Payroll, Timetable, Syllabus, Assessment." },
  { edition: "ULTRA", description: "Everything in Professional, plus Transport, Hostel, Library, Inventory, Communication, Documents, Biometric, Cameras, Alumni, and Analytics & Reports." },
];

// Deliberately no <FeatureLock> wrapper on this page, unlike every
// other dashboard module — the whole point is letting a FREE-tier org
// reach this page to stop being FREE-tier. Gating it behind a paid
// edition would be circular.
export default function BillingPage() {
  const status = useEditionStatus();
  const [upgrading, setUpgrading] = useState<Edition | null>(null);

  async function upgrade(edition: Edition) {
    setUpgrading(edition);
    try {
      const { actionUrl, fields } = await api.initiateBillingUpgrade({ targetEdition: edition as "PROFESSIONAL" | "ULTRA" });
      submitEsewaForm(actionUrl, fields);
      // Page navigates away to eSewa's own hosted checkout on success —
      // no further state update needed here.
    } catch (err) {
      toast.error(errorMessage(err, "Could not start the payment"));
      setUpgrading(null);
    }
  }

  const currentEdition = status.data?.edition;
  const expiresAt = status.data?.editionExpiresAt;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Pay to upgrade your institution&apos;s edition — real payment via eSewa, covering wallet, bank transfer, and
          Visa/MasterCard in one checkout. Each payment covers one month; renew any time before it lapses to keep your
          current edition, or renew early to add the extra month on top.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {!status.data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {currentEdition === "FREE" ? "Free" : currentEdition === "PROFESSIONAL" ? "Professional" : "Ultra"}
              </p>
              {expiresAt ? (
                <p className="text-muted-foreground text-sm">
                  Renews or expires on {new Date(expiresAt).toLocaleDateString()}.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {currentEdition === "FREE" ? "No payment required." : "Set by your platform administrator — no expiry."}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const price = EDITION_PRICING_NPR[plan.edition];
          const isCurrent = currentEdition ? meetsEdition(currentEdition, plan.edition) : false;
          return (
            <Card key={plan.edition}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{plan.edition === "PROFESSIONAL" ? "Professional" : "Ultra"}</CardTitle>
                {isCurrent ? <Badge>Current plan</Badge> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-semibold">
                  {price !== null ? NPR.format(price) : ""}
                  <span className="text-muted-foreground text-sm font-normal"> / month</span>
                </p>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={isCurrent || upgrading !== null || !status.data}
                  onClick={() => upgrade(plan.edition)}
                >
                  {upgrading === plan.edition ? "Redirecting to eSewa…" : isCurrent ? "Current plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
