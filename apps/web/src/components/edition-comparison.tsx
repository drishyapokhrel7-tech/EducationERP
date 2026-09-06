import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EDITION_PRICING_NPR } from "@/lib/edition-features";
import type { Edition } from "@education-erp/api-client";

const NPR = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 });

// All three tiers, unconditionally — unlike the billing page's own
// PLANS array (which only lists upgrade targets above the org's
// current edition), this is a purely informational "what do you get
// at each level" comparison, so Free belongs in it too.
const TIERS: { edition: Edition; label: string; description: string }[] = [
  { edition: "FREE", label: "Free", description: "Up to 50 combined student and staff records." },
  { edition: "PROFESSIONAL", label: "Professional", description: "Up to 500 combined student and staff records." },
  { edition: "ULTRA", label: "Ultra", description: "Up to 1,000 combined student and staff records." },
];

export function EditionComparisonGrid({ currentEdition }: { currentEdition?: Edition }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TIERS.map((tier) => {
        const price = EDITION_PRICING_NPR[tier.edition];
        return (
          <Card key={tier.edition}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{tier.label}</CardTitle>
              {currentEdition === tier.edition ? <Badge>Current plan</Badge> : null}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-semibold">
                {price !== null ? NPR.format(price) : "Free"}
                {price !== null ? <span className="text-muted-foreground text-sm font-normal"> / month</span> : null}
              </p>
              <p className="text-muted-foreground text-sm">{tier.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
