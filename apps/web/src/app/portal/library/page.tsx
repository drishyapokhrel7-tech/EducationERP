"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { libraryMemberApi, LibraryApiError } from "@/lib/library-api";
import { useLibraryMemberSession, setStoredLibraryMemberSession } from "@/lib/library-auth-storage";

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof LibraryApiError) {
    const message = (err.body as { message?: string } | undefined)?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function formatMoney(amount: string) {
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortalLibraryPage() {
  const { user } = useAuth();
  const session = useLibraryMemberSession();
  const [connectForm, setConnectForm] = useState({ identifier: user?.email ?? "", password: "" });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [query, setQuery] = useState("");

  const books = useSWR(["library-books", query], () => libraryMemberApi.searchBooks(query || undefined));
  const loans = useSWR(session ? "library-my-loans" : null, () => libraryMemberApi.listTransactions({ open: true }));
  const fines = useSWR(session ? "library-my-fines" : null, () => libraryMemberApi.listFines({}));
  const reservations = useSWR(session ? "library-my-reservations" : null, () => libraryMemberApi.listReservations({}));

  async function connect(e: FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setConnectError(null);
    try {
      const result = await libraryMemberApi.erpLogin(connectForm.identifier, connectForm.password);
      setStoredLibraryMemberSession(result);
      toast.success("Connected to the library");
    } catch (err) {
      setConnectError(errorMessage(err, "Could not connect — check your ERP password"));
    } finally {
      setConnecting(false);
    }
  }

  async function reserve(bookId: number) {
    try {
      await libraryMemberApi.createReservation({ bookId });
      reservations.mutate();
      toast.success("Reservation placed");
    } catch (err) {
      toast.error(errorMessage(err, "Could not place reservation"));
    }
  }

  async function cancelReservation(id: number) {
    try {
      await libraryMemberApi.cancelReservation(id);
      reservations.mutate();
    } catch (err) {
      toast.error(errorMessage(err, "Could not cancel reservation"));
    }
  }

  const outstandingFines = (fines.data ?? []).filter((f) => f.paidStatus === "UNPAID");
  const totalOwed = outstandingFines.reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">
          Search the catalog, place holds, and see your loans, fines, and reservations.
        </p>
      </div>

      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to Library</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap items-end gap-3" onSubmit={connect}>
              <div className="space-y-1">
                <Label className="text-xs">Email or Student ID</Label>
                <Input
                  className="w-56"
                  value={connectForm.identifier}
                  onChange={(e) => setConnectForm((f) => ({ ...f, identifier: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input
                  type="password"
                  className="w-48"
                  value={connectForm.password}
                  onChange={(e) => setConnectForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm" disabled={connecting || !connectForm.identifier || !connectForm.password}>
                {connecting ? "Connecting…" : "Connect"}
              </Button>
            </form>
            {connectError ? <p className="text-destructive mt-2 text-xs">{connectError}</p> : null}
            <p className="text-muted-foreground mt-2 text-xs">
              Uses your ERP password once to link your library account — nothing is stored beyond this browser session.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
                      {b.authors.map((a) => a.name).join(", ") || "Unknown author"}
                      {b.category ? ` · ${b.category.name}` : ""} · {b.availableCopies}/{b.copies} available
                    </p>
                  </div>
                  {session ? (
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

      {session ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>My Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {!loans.data || loans.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No open loans.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {loans.data.map((t) => (
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
                  <p className="text-sm font-medium">Total owed: {formatMoney(totalOwed.toFixed(2))}</p>
                  <ul className="divide-y text-sm">
                    {outstandingFines.map((f) => (
                      <li key={f.id} className="flex items-center justify-between py-2">
                        <span>{formatMoney(f.amount)}</span>
                        <Badge variant="warning">UNPAID</Badge>
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
                        {r.book.title} {r.readyAt ? <Badge variant="success">Ready</Badge> : <Badge variant="secondary">Pending</Badge>}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => cancelReservation(r.id)}>
                        Cancel
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
