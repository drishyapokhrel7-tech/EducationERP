"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/submit-action";
import { api } from "@/lib/api";

function formatMoney(amount: string | number) {
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fetches immediately off the existing ERP session, same shape as
// portal/invoices/page.tsx — no separate "Connect to Library" step,
// this module is native now, not a bridge to a separate service.
export default function PortalLibraryPage() {
  const [query, setQuery] = useState("");

  const books = useSWR(["library-books", query], () => api.searchLibraryBooks(query || undefined));
  const loans = useSWR("portal-library-my-loans", () => api.getMyLoans());
  const fines = useSWR("portal-library-my-fines", () => api.getMyLibraryFines());
  const reservations = useSWR("portal-library-my-reservations", () => api.getMyReservations());

  async function reserve(bookId: string) {
    try {
      await api.createMyReservation(bookId);
      reservations.mutate();
      toast.success("Reservation placed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not place reservation"));
    }
  }

  async function cancelReservation(id: string) {
    try {
      await api.cancelMyReservation(id);
      reservations.mutate();
      toast.success("Reservation cancelled");
    } catch (err) {
      toast.error(errorMessage(err, "Could not cancel reservation"));
    }
  }

  const outstandingFines = (fines.data ?? []).filter((f) => f.status === "PENDING");
  const totalOwed = outstandingFines.reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">
          Search the catalog, place holds, and see your loans, fines, and reservations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search by title, ISBN, author…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {!books.data || books.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No books found.</p>
          ) : (
            <ul className="divide-y text-sm">
              {books.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{b.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {b.author ?? "Unknown author"}
                      {b.category ? ` · ${b.category.name}` : ""} · {b.availableCopies}/{b.totalCopies} available
                    </p>
                  </div>
                  {b.availableCopies === 0 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => reserve(b.id)}>
                      Reserve
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {!loans.data || loans.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open loans.</p>
          ) : (
            <ul className="divide-y text-sm">
              {loans.data
                .filter((t) => !t.returnedAt)
                .map((t) => (
                  <li key={t.id} className="py-2">
                    {t.book.title} <span className="text-muted-foreground">— due {new Date(t.dueDate).toLocaleDateString()}</span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Fines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {outstandingFines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No outstanding fines.</p>
          ) : (
            <>
              <p className="text-sm font-medium">Total owed: {formatMoney(totalOwed)}</p>
              <ul className="divide-y text-sm">
                {outstandingFines.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <span>
                      {formatMoney(f.amount)} <span className="text-muted-foreground text-xs">({f.reason})</span>
                    </span>
                    <Badge variant="warning">PENDING</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          {!reservations.data || reservations.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reservations.</p>
          ) : (
            <ul className="divide-y text-sm">
              {reservations.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>
                    {r.book.title}{" "}
                    {r.status === "READY" ? (
                      <Badge variant="success">Ready</Badge>
                    ) : r.status === "PENDING" ? (
                      <Badge variant="secondary">Pending</Badge>
                    ) : (
                      <Badge variant="outline">{r.status}</Badge>
                    )}
                  </span>
                  {r.status === "PENDING" || r.status === "READY" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => cancelReservation(r.id)}>
                      Cancel
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
