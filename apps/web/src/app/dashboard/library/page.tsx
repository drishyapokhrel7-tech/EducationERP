"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { FaceCapture, type FaceCaptureResult } from "@/components/library/face-capture";
import { PageSubNav } from "@/components/dashboard/page-subnav";
import { libraryStaffApi, LibraryApiError, type FineCollectionReport } from "@/lib/library-api";
import { useLibraryStaffSession, setStoredLibraryStaffSession } from "@/lib/library-auth-storage";
import { useAuth } from "@/lib/auth-context";
import { getAccessToken } from "@/lib/auth-storage";

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof LibraryApiError) {
    const message = (err.body as { message?: string } | undefined)?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function submitAction(action: () => Promise<unknown>, onSuccess: () => void) {
  try {
    await action();
    onSuccess();
    toast.success("Saved");
  } catch (err) {
    toast.error(errorMessage(err, "Failed"));
  }
}

function formatMoney(amount: string) {
  return `NPR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataUrlFromBlob(blob: Blob): Promise<File> {
  return Promise.resolve(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
}

export default function LibraryDashboardPage() {
  const { user } = useAuth();
  const session = useLibraryStaffSession();

  // ── Staff login ────────────────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // ── ERP-SSO login (for staff granted the ERP's "Librarian" role) ────
  const [ssoForm, setSsoForm] = useState({ identifier: user?.email ?? "", password: "" });
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoLoggingIn, setSsoLoggingIn] = useState(false);

  // Silently bridge the ERP session already open in this browser,
  // instead of asking an already-logged-in admin to type their
  // password a second time (the exact "asks you to log in again" UX
  // audit finding). Only the manual forms below (ERP password, or a
  // separate library account) fall back into view on a genuine
  // failure — not linked, no Librarian role, or no ERP session at all.
  const [silentConnecting, setSilentConnecting] = useState(true);
  const [silentFailure, setSilentFailure] = useState<string | null>(null);
  const silentAttempted = useRef(false);

  useEffect(() => {
    if (session || silentAttempted.current) return;
    silentAttempted.current = true;
    async function run() {
      const erpToken = getAccessToken();
      if (!erpToken) {
        setSilentConnecting(false);
        return;
      }
      try {
        const result = await libraryStaffApi.erpTokenLogin(erpToken);
        if (result.user.role === "MEMBER") {
          setSilentFailure("Your ERP account doesn't have the Librarian role — ask an admin to grant it via Roles & Permissions.");
          return;
        }
        setStoredLibraryStaffSession(result);
        toast.success("Connected to Library as " + result.user.role.toLowerCase());
      } catch (err) {
        setSilentFailure(errorMessage(err, "Could not connect automatically — sign in below."));
      } finally {
        setSilentConnecting(false);
      }
    }
    void Promise.resolve().then(run);
  }, [session]);

  // ── Catalog ────────────────────────────────────────────────────────
  const categories = useSWR(session ? "library-categories" : null, () => libraryStaffApi.listCategories());
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [bookQuery, setBookQuery] = useState("");
  const books = useSWR(session ? ["library-books", bookQuery] : null, () => libraryStaffApi.searchBooks(bookQuery || undefined));
  const [bookForm, setBookForm] = useState({
    title: "",
    isbn: "",
    categoryId: "",
    publisher: "",
    edition: "",
    copies: "1",
    entryMethod: "MANUAL" as "MANUAL" | "ISBN_SCAN" | "OCR",
  });
  const [isbnLookupValue, setIsbnLookupValue] = useState("");

  // ── Members ────────────────────────────────────────────────────────
  const members = useSWR(session ? "library-members" : null, () => libraryStaffApi.listMembers());
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);

  // ── Circulation ────────────────────────────────────────────────────
  const openTransactions = useSWR(session ? "library-open-transactions" : null, () => libraryStaffApi.listTransactions({ open: true }));
  const [issueForm, setIssueForm] = useState({ bookId: "", memberId: "" });
  const [issueFace, setIssueFace] = useState<FaceCaptureResult | null>(null);
  const [issueOverride, setIssueOverride] = useState(false);
  const [returnTransactionId, setReturnTransactionId] = useState("");
  const [returnFace, setReturnFace] = useState<FaceCaptureResult | null>(null);
  const [returnOverride, setReturnOverride] = useState(false);

  // ── Fines ──────────────────────────────────────────────────────────
  const [fineFilter, setFineFilter] = useState<"UNPAID" | "PAID" | "">("UNPAID");
  const fines = useSWR(session ? ["library-fines", fineFilter] : null, () =>
    libraryStaffApi.listFines(fineFilter ? { paidStatus: fineFilter } : {}),
  );

  // ── Reservations ───────────────────────────────────────────────────
  const reservations = useSWR(session ? "library-all-reservations" : null, () => libraryStaffApi.listReservations({}));

  // ── Reports ────────────────────────────────────────────────────────
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const overdue = useSWR(session ? "library-report-overdue" : null, () => libraryStaffApi.getOverdueReport());
  const mostBorrowed = useSWR(session ? "library-report-most-borrowed" : null, () => libraryStaffApi.getMostBorrowedReport());
  const [fineCollection, setFineCollection] = useState<FineCollectionReport | null>(null);

  // ── Settings ───────────────────────────────────────────────────────
  const config = useSWR(session ? "library-system-config" : null, () => libraryStaffApi.getSystemConfig());
  const [configForm, setConfigForm] = useState<{ finePerDayRate: string; faceMatchConfidenceMin: string; loanPeriodDays: string } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function staffLogin(e: FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const result = await libraryStaffApi.staffLogin(loginForm.username, loginForm.password);
      setStoredLibraryStaffSession(result);
      toast.success("Logged in to Library");
    } catch (err) {
      setLoginError(errorMessage(err, "Invalid credentials"));
    } finally {
      setLoggingIn(false);
    }
  }

  // POST /auth/erp-login is a single shared endpoint that can return either a
  // MEMBER or a LIBRARIAN session depending on the caller's ERP roles — a
  // MEMBER result here must be rejected, not stored, or a staff member
  // without the Librarian role would silently see the wrong kind of session
  // in the staff store (the exact class of bug this integration's own
  // session-separation fix already addressed once, see
  // LIBRARY_SYSTEM_INTEGRATION_NOTES.md).
  async function ssoLogin(e: FormEvent) {
    e.preventDefault();
    setSsoLoggingIn(true);
    setSsoError(null);
    try {
      const result = await libraryStaffApi.erpLogin(ssoForm.identifier, ssoForm.password);
      if (result.user.role === "MEMBER") {
        setSsoError("Your ERP account doesn't have the Librarian role — ask an admin to grant it via Roles & Permissions.");
        return;
      }
      setStoredLibraryStaffSession(result);
      toast.success("Connected to Library as " + result.user.role.toLowerCase());
    } catch (err) {
      setSsoError(errorMessage(err, "Could not connect — check your ERP password"));
    } finally {
      setSsoLoggingIn(false);
    }
  }

  const activeMember = members.data?.find((m) => m.id === activeMemberId) ?? null;
  const cfg = configForm ?? (config.data ? { finePerDayRate: config.data.finePerDayRate, faceMatchConfidenceMin: String(config.data.faceMatchConfidenceMin), loanPeriodDays: String(config.data.loanPeriodDays) } : null);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">
          Catalog, circulation, fines, reservations, and reports from the connected Library System.
        </p>
      </div>

      {!session && silentConnecting ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">Connecting to Library using your current session…</p>
          </CardContent>
        </Card>
      ) : !session ? (
        <Card>
          <CardHeader>
            <CardTitle>Library staff login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {silentFailure ? <p className="text-destructive text-xs">{silentFailure}</p> : null}
            <div>
              <p className="text-muted-foreground mb-3 text-xs">
                Connect with your ERP session — works if an admin has granted you the &quot;Librarian&quot; role via{" "}
                <a href="/dashboard/roles-permissions" className="underline">
                  Roles &amp; Permissions
                </a>
                .
              </p>
              <form className="flex flex-wrap items-end gap-3" onSubmit={ssoLogin}>
                <div className="space-y-1">
                  <Label className="text-xs">ERP email or student ID</Label>
                  <Input
                    className="w-56"
                    value={ssoForm.identifier}
                    onChange={(e) => setSsoForm((f) => ({ ...f, identifier: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ERP password</Label>
                  <Input
                    type="password"
                    className="w-48"
                    value={ssoForm.password}
                    onChange={(e) => setSsoForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={ssoLoggingIn || !ssoForm.identifier || !ssoForm.password}>
                  {ssoLoggingIn ? "Connecting…" : "Connect via ERP"}
                </Button>
              </form>
              {ssoError ? <p className="text-destructive mt-2 text-xs">{ssoError}</p> : null}
            </div>

            <Separator />

            <div>
              <p className="text-muted-foreground mb-3 text-xs">Or a separate Librarian/Administrator library account.</p>
              <form className="flex flex-wrap items-end gap-3" onSubmit={staffLogin}>
                <div className="space-y-1">
                  <Label className="text-xs">Username</Label>
                  <Input className="w-48" value={loginForm.username} onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <Input
                    type="password"
                    className="w-48"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <Button type="submit" size="sm" disabled={loggingIn || !loginForm.username || !loginForm.password}>
                  {loggingIn ? "Signing in…" : "Sign in"}
                </Button>
              </form>
              {loginError ? <p className="text-destructive mt-2 text-xs">{loginError}</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setStoredLibraryStaffSession(null)}>
              Sign out of Library
            </Button>
          </div>

          <PageSubNav
            sections={[
              { id: "catalog-categories", label: "Categories" },
              { id: "catalog-books", label: "Books" },
              { id: "members", label: "Members" },
              { id: "circulation", label: "Circulation" },
              { id: "fines", label: "Fines" },
              { id: "reservations", label: "Reservations" },
              { id: "reports", label: "Reports" },
              { id: "settings", label: "Settings" },
            ]}
          />

          {/* ── Catalog ─────────────────────────────────────────────── */}
          <Card id="catalog-categories" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Catalog — Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!categories.data || categories.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No categories yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {categories.data.map((c) => (
                    <li key={c.id} className="py-2">
                      {c.name} {c.description ? <span className="text-muted-foreground">— {c.description}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              <Separator />
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () => libraryStaffApi.createCategory({ name: categoryForm.name, description: categoryForm.description || undefined }),
                    () => {
                      setCategoryForm({ name: "", description: "" });
                      categories.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input className="w-56" value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <Button type="submit" size="sm" disabled={!categoryForm.name}>
                  Add category
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card id="catalog-books" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Catalog — Books</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search…" value={bookQuery} onChange={(e) => setBookQuery(e.target.value)} />
              {!books.data || books.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No books found.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {books.data.map((b) => (
                    <li key={b.id} className="py-2">
                      <span className="font-medium">{b.title}</span>{" "}
                      <span className="text-muted-foreground">
                        — {b.isbn ?? "no ISBN"} · {b.category?.name ?? "uncategorized"} · {b.availableCopies}/{b.copies} available ·{" "}
                        <Badge variant={b.status === "ACTIVE" ? "success" : "secondary"}>{b.status}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Separator />
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">ISBN lookup</Label>
                  <Input className="w-40" value={isbnLookupValue} onChange={(e) => setIsbnLookupValue(e.target.value)} />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!isbnLookupValue}
                  onClick={async () => {
                    try {
                      const result = await libraryStaffApi.isbnLookup(isbnLookupValue);
                      setBookForm((f) => ({
                        ...f,
                        title: result.title ?? f.title,
                        isbn: result.isbn ?? isbnLookupValue,
                        publisher: result.publisher ?? f.publisher,
                        entryMethod: "ISBN_SCAN",
                      }));
                      toast.success("Prefilled from ISBN lookup — review before saving");
                    } catch (err) {
                      toast.error(errorMessage(err, "ISBN lookup failed"));
                    }
                  }}
                >
                  Prefill from ISBN
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs">Or scan a cover photo (OCR)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="w-56"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const result = await libraryStaffApi.ocrScan(file);
                        setBookForm((f) => ({ ...f, title: result.title ?? f.title, entryMethod: "OCR" }));
                        toast.success(result.lowConfidence ? "Prefilled (low confidence) — review before saving" : "Prefilled from cover scan — review before saving");
                      } catch (err) {
                        toast.error(errorMessage(err, "OCR scan failed"));
                      }
                    }}
                  />
                </div>
              </div>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  submitAction(
                    () =>
                      libraryStaffApi.createBook({
                        title: bookForm.title,
                        isbn: bookForm.isbn || undefined,
                        categoryId: bookForm.categoryId ? Number(bookForm.categoryId) : undefined,
                        publisher: bookForm.publisher || undefined,
                        edition: bookForm.edition || undefined,
                        copies: Number(bookForm.copies) || 1,
                        entryMethod: bookForm.entryMethod,
                      }),
                    () => {
                      setBookForm({ title: "", isbn: "", categoryId: "", publisher: "", edition: "", copies: "1", entryMethod: "MANUAL" });
                      setIsbnLookupValue("");
                      books.mutate();
                    },
                  );
                }}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input className="w-48" value={bookForm.title} onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ISBN</Label>
                  <Input className="w-36" value={bookForm.isbn} onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <NativeSelect
                    className="w-40"
                    placeholder="Uncategorized"
                    value={bookForm.categoryId}
                    onChange={(v) => setBookForm((f) => ({ ...f, categoryId: v }))}
                    options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Copies</Label>
                  <Input type="number" className="w-20" value={bookForm.copies} onChange={(e) => setBookForm((f) => ({ ...f, copies: e.target.value }))} />
                </div>
                <Button type="submit" size="sm" disabled={!bookForm.title}>
                  Add book
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── Members ─────────────────────────────────────────────── */}
          <Card id="members" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!members.data || members.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No members yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {members.data.map((m) => (
                    <li key={m.id} className="py-2">
                      <button type="button" className="hover:text-primary text-left" onClick={() => setActiveMemberId(m.id)}>
                        {m.name} <span className="text-muted-foreground">— {m.type} · {m.status}{m.erpRefId ? " · ERP-linked" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {activeMember ? (
                <div className="bg-muted/40 space-y-2 rounded-lg border p-4 text-sm">
                  <p className="font-medium">{activeMember.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {activeMember.type} · {activeMember.status} · joined {new Date(activeMember.joinDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs font-medium">Enroll face template</p>
                  <FaceCapture
                    onCapture={async (result) => {
                      try {
                        const file = await dataUrlFromBlob(result.blob);
                        const enrolled = await libraryStaffApi.enrollFaceTemplate(activeMember.id, file);
                        toast.success(`Face template enrolled (confidence ${enrolled.detectionConfidence.toFixed(2)})`);
                      } catch (err) {
                        toast.error(errorMessage(err, "Could not enroll face template"));
                      }
                    }}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* ── Circulation ─────────────────────────────────────────── */}
          <Card id="circulation" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Circulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Issue a book</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Book</Label>
                    <NativeSelect
                      className="w-48"
                      placeholder="Select book"
                      value={issueForm.bookId}
                      onChange={(v) => setIssueForm((f) => ({ ...f, bookId: v }))}
                      options={(books.data ?? []).map((b) => ({ value: String(b.id), label: b.title }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Member</Label>
                    <NativeSelect
                      className="w-48"
                      placeholder="Select member"
                      value={issueForm.memberId}
                      onChange={(v) => setIssueForm((f) => ({ ...f, memberId: v }))}
                      options={(members.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
                    />
                  </div>
                </div>
                <FaceCapture onCapture={setIssueFace} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={issueOverride} onChange={(e) => setIssueOverride(e.target.checked)} />
                  Manual override (no camera / no face match required)
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!issueForm.bookId || !issueForm.memberId}
                  onClick={() =>
                    submitAction(
                      () =>
                        libraryStaffApi.issueBook({
                          bookId: Number(issueForm.bookId),
                          memberId: Number(issueForm.memberId),
                          faceImageBase64: issueFace?.base64,
                          manualOverride: issueOverride,
                        }),
                      () => {
                        setIssueForm({ bookId: "", memberId: "" });
                        setIssueFace(null);
                        setIssueOverride(false);
                        openTransactions.mutate();
                        books.mutate();
                      },
                    )
                  }
                >
                  Issue
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Return a book</p>
                <NativeSelect
                  className="w-64"
                  placeholder="Select open loan"
                  value={returnTransactionId}
                  onChange={setReturnTransactionId}
                  options={(openTransactions.data ?? []).map((t) => ({ value: String(t.id), label: `${t.book.title} — ${t.member.name}` }))}
                />
                <FaceCapture onCapture={setReturnFace} />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={returnOverride} onChange={(e) => setReturnOverride(e.target.checked)} />
                  Manual override
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!returnTransactionId}
                  onClick={() =>
                    submitAction(
                      () =>
                        libraryStaffApi.returnBook({
                          transactionId: Number(returnTransactionId),
                          faceImageBase64: returnFace?.base64,
                          manualOverride: returnOverride,
                        }),
                      () => {
                        setReturnTransactionId("");
                        setReturnFace(null);
                        setReturnOverride(false);
                        openTransactions.mutate();
                        fines.mutate();
                        books.mutate();
                      },
                    )
                  }
                >
                  Return
                </Button>
              </div>

              <Separator />
              <p className="text-sm font-medium">Open loans</p>
              {!openTransactions.data || openTransactions.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">None.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {openTransactions.data.map((t) => (
                    <li key={t.id} className="py-2">
                      {t.book.title} — {t.member.name} <span className="text-muted-foreground">due {new Date(t.dueDate).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Fines ───────────────────────────────────────────────── */}
          <Card id="fines" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Fines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <NativeSelect
                className="w-40"
                placeholder="All"
                value={fineFilter}
                onChange={(v) => setFineFilter(v as "UNPAID" | "PAID" | "")}
                options={[
                  { value: "UNPAID", label: "Unpaid" },
                  { value: "PAID", label: "Paid" },
                ]}
              />
              {!fines.data || fines.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No fines.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {fines.data.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {formatMoney(f.amount)} <Badge variant={f.paidStatus === "PAID" ? "success" : "warning"}>{f.paidStatus}</Badge>
                        {f.erpInvoiceId ? <span className="text-muted-foreground text-xs"> · posted to ERP</span> : null}
                      </span>
                      <div className="flex gap-2">
                        {f.paidStatus === "UNPAID" ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => submitAction(() => libraryStaffApi.payFine(f.id), () => fines.mutate())}>
                            Mark paid
                          </Button>
                        ) : null}
                        {!f.erpInvoiceId ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => submitAction(() => libraryStaffApi.postFineToErp(f.id), () => fines.mutate())}>
                            Post to ERP
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Reservations ────────────────────────────────────────── */}
          <Card id="reservations" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              {!reservations.data || reservations.data.length === 0 ? (
                <p className="text-muted-foreground text-sm">No reservations.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {reservations.data.map((r) => (
                    <li key={r.id} className="py-2">
                      {r.book.title} — {r.member.name}{" "}
                      {r.readyAt ? <Badge variant="success">Ready</Badge> : <Badge variant="secondary">Pending</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Reports ─────────────────────────────────────────────── */}
          <Card id="reports" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Overdue</p>
                {!overdue.data || overdue.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None overdue.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {overdue.data.map((r) => (
                      <li key={r.id} className="py-1">
                        {r.book.title} — {r.member.name} <span className="text-muted-foreground">due {new Date(r.dueDate).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Most borrowed</p>
                {!mostBorrowed.data || mostBorrowed.data.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No data yet.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {mostBorrowed.data.map((row, i) => (
                      <li key={i} className="py-1">
                        {row.book.title} — {row.borrowCount} loans
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Fine collection</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" className="h-8 w-36" value={reportRange.from} onChange={(e) => setReportRange((r) => ({ ...r, from: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" className="h-8 w-36" value={reportRange.to} onChange={(e) => setReportRange((r) => ({ ...r, to: e.target.value }))} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={async () => {
                      try {
                        const result = await libraryStaffApi.getFineCollectionReport({ from: reportRange.from || undefined, to: reportRange.to || undefined });
                        setFineCollection(result);
                      } catch (err) {
                        toast.error(errorMessage(err, "Could not load report"));
                      }
                    }}
                  >
                    Run
                  </Button>
                </div>
                {fineCollection ? (
                  <p className="text-sm">
                    Assessed: {formatMoney(String(fineCollection.totalAssessed))} ({fineCollection.countAssessed}) · Collected:{" "}
                    {formatMoney(String(fineCollection.totalCollected))} ({fineCollection.countCollected}) · Outstanding:{" "}
                    {formatMoney(String(fineCollection.totalOutstanding))} ({fineCollection.countOutstanding})
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* ── Settings ────────────────────────────────────────────── */}
          <Card id="settings" className="scroll-mt-16">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cfg ? (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submitAction(
                      () =>
                        libraryStaffApi.updateSystemConfig({
                          finePerDayRate: Number(cfg.finePerDayRate),
                          faceMatchConfidenceMin: Number(cfg.faceMatchConfidenceMin),
                          loanPeriodDays: Number(cfg.loanPeriodDays),
                        }),
                      () => config.mutate(),
                    );
                  }}
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Fine per day (NPR)</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={cfg.finePerDayRate}
                      onChange={(e) => setConfigForm({ ...cfg, finePerDayRate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Loan period (days)</Label>
                    <Input
                      type="number"
                      className="w-28"
                      value={cfg.loanPeriodDays}
                      onChange={(e) => setConfigForm({ ...cfg, loanPeriodDays: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Face-match confidence min</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-28"
                      value={cfg.faceMatchConfidenceMin}
                      onChange={(e) => setConfigForm({ ...cfg, faceMatchConfidenceMin: e.target.value })}
                    />
                  </div>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              ) : null}
              {config.data ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>ERP fee posting:</span>
                  <Badge variant={config.data.erpFeePostingEnabled ? "success" : "secondary"}>
                    {config.data.erpFeePostingEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      submitAction(
                        () => libraryStaffApi.updateSystemConfig({ erpFeePostingEnabled: !config.data!.erpFeePostingEnabled }),
                        () => config.mutate(),
                      )
                    }
                  >
                    Toggle
                  </Button>
                </div>
              ) : null}
              <Separator />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await libraryStaffApi.syncRoster();
                      setSyncResult(
                        `Found ${result.studentsFound} students, ${result.employeesFound} employees — ${result.created} created, ${result.updated} updated, ${result.suspended} suspended.`,
                      );
                      members.mutate();
                    } catch (err) {
                      toast.error(errorMessage(err, "Roster sync failed"));
                    }
                  }}
                >
                  Sync roster from ERP
                </Button>
                {syncResult ? <span className="text-muted-foreground text-xs">{syncResult}</span> : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
