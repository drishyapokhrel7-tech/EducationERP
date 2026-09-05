"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/submit-action";
import { useEditionStatus } from "@/lib/use-edition-status";
import { EDITION_PRICING_NPR, meetsEdition } from "@/lib/edition-features";
import type { Edition } from "@education-erp/api-client";

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

const CONTACT_EMAIL = "ovexatechnology@gmail.com";
const CONTACT_PHONE = "+977 9768786270";
const CONTACT_PHONE_TEL = "+9779768786270";

const PLANS: { edition: Edition; description: string }[] = [
  { edition: "PROFESSIONAL", description: "Finance, HR & Payroll, Timetable, Syllabus, Assessment." },
  { edition: "ULTRA", description: "Everything in Professional, plus Transport, Hostel, Library, Inventory, Communication, Documents, Biometric, Cameras, Alumni, and Analytics & Reports." },
];

// Online checkout via eSewa is temporarily disabled here — BillingService's
// initiateUpgrade/confirmUpgrade and the eSewa callback page are untouched
// and can be wired back into this page's plan-card buttons at any time.
// In the meantime, an org requests an upgrade manually below; Ovexa staff
// see it in the Platform Admin console and follow up directly.
//
// Deliberately no <FeatureLock> wrapper on this page, unlike every
// other dashboard module — the whole point is letting a FREE-tier org
// reach this page to stop being FREE-tier. Gating it behind a paid
// edition would be circular.
export default function BillingPage() {
  const status = useEditionStatus();
  const currentEdition = status.data?.edition;
  const expiresAt = status.data?.editionExpiresAt;

  const availablePlans = PLANS.filter((plan) => !currentEdition || !meetsEdition(currentEdition, plan.edition));

  const [targetEdition, setTargetEdition] = useState<Edition | "">("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submitRequest() {
    if (!targetEdition || !contactPhone.trim()) {
      toast.error("Choose a plan and enter a contact phone number");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitUpgradeRequest({
        targetEdition: targetEdition as "PROFESSIONAL" | "ULTRA",
        contactPhone: contactPhone.trim(),
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(errorMessage(err, "Could not submit your request"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Upgrade your institution&apos;s edition — Professional or Ultra. Online payment is temporarily unavailable;
          request an upgrade below and our team will contact you directly.
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

      <Card>
        <CardHeader>
          <CardTitle>Contact us to upgrade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Email:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>
            Phone:{" "}
            <a href={`tel:${CONTACT_PHONE_TEL}`} className="text-primary underline underline-offset-4">
              {CONTACT_PHONE}
            </a>
          </p>
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {availablePlans.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Request an upgrade</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <p className="text-muted-foreground text-sm">
                Request received — we&apos;ll contact you shortly at that number, or at your account email.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <NativeSelect
                    className="w-full sm:w-64"
                    placeholder="Select a plan"
                    value={targetEdition}
                    onChange={(v) => setTargetEdition(v as Edition)}
                    options={availablePlans.map((plan) => ({
                      value: plan.edition,
                      label: plan.edition === "PROFESSIONAL" ? "Professional" : "Ultra",
                    }))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact phone number</Label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything else we should know?"
                    disabled={submitting}
                  />
                </div>
                <Button type="button" onClick={submitRequest} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
