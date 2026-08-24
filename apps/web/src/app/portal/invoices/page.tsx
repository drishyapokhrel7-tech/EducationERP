"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { statusVariant } from "@/lib/status-variant";
import { submitEsewaForm } from "@/lib/esewa";

function errorMessage(err: unknown, fallback: string) {
  const message =
    err && typeof err === "object" && "body" in err
      ? ((err as { body?: { message?: string } }).body?.message ?? null)
      : null;
  return typeof message === "string" ? message : fallback;
}

function formatMoney(amount: string) {
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function outstandingBalance(inv: { totalAmount: string; discounts: { amount: string }[]; payments: { amount: string }[] }) {
  const discounted = Number(inv.totalAmount) - inv.discounts.reduce((sum, d) => sum + Number(d.amount), 0);
  const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.max(discounted - paid, 0);
}

export default function PortalInvoicesPage() {
  const invoices = useSWR("portal-invoices", () => api.getPortalInvoices());
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Invoices</h1>
        <p className="text-muted-foreground text-sm">Fees assigned to you, and online payment via eSewa.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {!invoices.data || invoices.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <ul className="divide-y">
              {invoices.data.map((inv) => {
                const outstanding = outstandingBalance(inv);
                return (
                  <li key={inv.id} className="space-y-2 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {formatMoney(inv.totalAmount)} <span className="text-muted-foreground">· due {new Date(inv.dueDate).toLocaleDateString()}</span>
                      </span>
                      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                    </div>
                    <ul className="text-muted-foreground pl-4 text-xs">
                      {inv.items.map((i) => (
                        <li key={i.id}>
                          {i.feeCategory.name}: {formatMoney(i.amount)}
                        </li>
                      ))}
                    </ul>
                    {inv.status !== "CANCELLED" && outstanding > 0 ? (
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount (outstanding: {formatMoney(outstanding.toFixed(2))})</Label>
                          <Input
                            type="number"
                            className="h-8 w-32"
                            value={payAmount[inv.id] ?? outstanding.toFixed(2)}
                            onChange={(e) => setPayAmount((f) => ({ ...f, [inv.id]: e.target.value }))}
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          onClick={async () => {
                            try {
                              const amount = Number(payAmount[inv.id] ?? outstanding.toFixed(2));
                              const { actionUrl, fields } = await api.initiatePortalEsewaPayment(inv.id, { amount });
                              submitEsewaForm(actionUrl, fields);
                            } catch (err) {
                              toast.error(errorMessage(err, "Could not start the eSewa payment"));
                            }
                          }}
                        >
                          Pay with eSewa
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
