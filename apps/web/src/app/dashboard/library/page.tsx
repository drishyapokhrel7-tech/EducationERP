"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { PageSubNav } from "@/components/dashboard/page-subnav";
import { ListPager } from "@/components/dashboard/list-pager";
import {
  PersonPicker,
  studentToPersonOption,
  employeeToPersonOption,
  bookToPersonOption,
} from "@/components/person-picker";
import { toast } from "sonner";
import { CameraCapture } from "@/components/camera-capture";
import { submitAction, submitDelete, errorMessage } from "@/lib/submit-action";
import { api } from "@/lib/api";
import type { LibraryTransactionRecord, LibraryFineRecord, LibraryReservationRecord } from "@education-erp/api-client";

const EMPTY_BOOK_FORM = {
  title: "",
  isbn: "",
  author: "",
  publisher: "",
  edition: "",
  coverImageUrl: "",
  categoryId: "",
  shelfLocation: "",
  totalCopies: "1",
};

function borrowerLabel(row: { student: { firstName: string; lastName: string } | null; employee: { firstName: string; lastName: string } | null }) {
  if (row.student) return `${row.student.firstName} ${row.student.lastName} (Student)`;
  if (row.employee) return `${row.employee.firstName} ${row.employee.lastName} (Staff)`;
  return "Unknown borrower";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// A borrower field shared by the issue/reserve/manual-fine forms —
// toggle between Student/Employee, then the matching PersonPicker.
// Kept local (not a shared component) since each of the three call
// sites carries its own independent local form state.
function BorrowerField({
  type,
  onTypeChange,
  studentId,
  employeeId,
  onStudentChange,
  onEmployeeChange,
  studentOptions,
  employeeOptions,
}: {
  type: "student" | "employee";
  onTypeChange: (t: "student" | "employee") => void;
  studentId: string;
  employeeId: string;
  onStudentChange: (id: string) => void;
  onEmployeeChange: (id: string) => void;
  studentOptions: ReturnType<typeof studentToPersonOption>[];
  employeeOptions: ReturnType<typeof employeeToPersonOption>[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Borrower type</Label>
        <NativeSelect
          className="w-28"
          placeholder="Type"
          value={type}
          onChange={(v) => onTypeChange(v as "student" | "employee")}
          options={[
            { value: "student", label: "Student" },
            { value: "employee", label: "Staff" },
          ]}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Borrower</Label>
        {type === "student" ? (
          <PersonPicker
            className="w-64"
            placeholder="Select student"
            value={studentId}
            onChange={onStudentChange}
            options={studentOptions}
          />
        ) : (
          <PersonPicker
            className="w-64"
            placeholder="Select staff"
            value={employeeId}
            onChange={onEmployeeChange}
            options={employeeOptions}
          />
        )}
      </div>
    </div>
  );
}

export default function LibraryDashboardPage() {
  // ── Reference data ───────────────────────────────────────────────
  const categories = useSWR("library-categories", () => api.listBookCategories());
  const studentsPicker = useSWR("students-picker", () => api.listStudentsPicker());
  const employeesPicker = useSWR("employees-picker", () => api.listEmployeesPicker());
  const booksPicker = useSWR("library-books-picker", () => api.listBooksPicker());
  const studentOptions = (studentsPicker.data ?? []).map(studentToPersonOption);
  const employeeOptions = (employeesPicker.data ?? []).map(employeeToPersonOption);
  const bookOptions = (booksPicker.data ?? []).map(bookToPersonOption);

  // ── Categories ────────────────────────────────────────────────────
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ name: "", code: "" });

  // ── Books ─────────────────────────────────────────────────────────
  const [booksPage, setBooksPage] = useState(1);
  const books = useSWR(["library-books", booksPage], () => api.listBooks({ page: booksPage, pageSize: 25 }));
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editBookForm, setEditBookForm] = useState(EMPTY_BOOK_FORM);

  // Minimal-data-entry helpers for the "Add book" form below — both
  // preview-only, they only ever prefill bookForm, never submit on
  // their own; the human still reviews and presses "Add book" (never
  // auto-submit, same precedent PhotoInput/librarysystem's own Phase 5
  // already established for anything OCR/lookup-assisted).
  const [isbnLookupValue, setIsbnLookupValue] = useState("");
  const [isbnLookingUp, setIsbnLookingUp] = useState(false);
  const [showCoverScan, setShowCoverScan] = useState(false);
  const [scanningCover, setScanningCover] = useState(false);

  async function lookupIsbn() {
    setIsbnLookingUp(true);
    try {
      const result = await api.isbnLookupBook(isbnLookupValue);
      setBookForm((f) => ({
        ...f,
        title: result.title ?? f.title,
        isbn: isbnLookupValue,
        author: result.author ?? f.author,
        publisher: result.publisher ?? f.publisher,
        coverImageUrl: result.coverImageUrl ?? f.coverImageUrl,
      }));
      toast.success("Prefilled from ISBN lookup — review before saving");
    } catch (err) {
      toast.error(errorMessage(err, "ISBN lookup failed — no record for this ISBN, or the lookup service is unreachable"));
    } finally {
      setIsbnLookingUp(false);
    }
  }

  async function scanCover(file: File) {
    setScanningCover(true);
    try {
      const result = await api.ocrScanBookCover(file);
      setBookForm((f) => ({ ...f, title: result.title ?? f.title, author: result.author ?? f.author }));
      toast.success(
        result.lowConfidence
          ? "Prefilled from cover scan (low confidence) — check carefully before saving"
          : "Prefilled from cover scan — review before saving",
      );
    } catch (err) {
      toast.error(errorMessage(err, "Cover scan failed"));
    } finally {
      setScanningCover(false);
      setShowCoverScan(false);
    }
  }

  function refreshBookLists() {
    books.mutate();
    booksPicker.mutate();
  }

  // ── Circulation ───────────────────────────────────────────────────
  const openTransactions = useSWR("library-open-transactions", () =>
    api.listLibraryTransactions({ open: true }),
  );
  const [issueBookId, setIssueBookId] = useState("");
  const [issueBorrowerType, setIssueBorrowerType] = useState<"student" | "employee">("student");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueEmployeeId, setIssueEmployeeId] = useState("");

  // Optional face verification at issue time — reuses this ERP's own
  // Phase 6 biometric infrastructure server-side. Opt-in, never
  // blocking: no capture means no check at all; a capture that
  // doesn't come back MATCHED just surfaces the reason in the error
  // toast and asks for manualOverride, same "never a dead end"
  // precedent as PhotoInput/CameraCapture's own camera-denied fallback.
  const [showIssueFaceCapture, setShowIssueFaceCapture] = useState(false);
  const [issueFaceImageBase64, setIssueFaceImageBase64] = useState<string | null>(null);
  const [issueManualOverride, setIssueManualOverride] = useState(false);

  // ── Fines ─────────────────────────────────────────────────────────
  const [fineStatusFilter, setFineStatusFilter] = useState<"PENDING" | "PAID" | "WAIVED" | "">("PENDING");
  const fines = useSWR(["library-fines", fineStatusFilter], () =>
    api.listLibraryFines(fineStatusFilter ? { status: fineStatusFilter } : {}),
  );
  const [fineForm, setFineForm] = useState({ bookId: "", reason: "LOST" as "LOST" | "DAMAGED", amount: "" });
  const [fineBorrowerType, setFineBorrowerType] = useState<"student" | "employee">("student");
  const [fineStudentId, setFineStudentId] = useState("");
  const [fineEmployeeId, setFineEmployeeId] = useState("");

  // ── Reservations ──────────────────────────────────────────────────
  const reservations = useSWR("library-reservations", () => api.listLibraryReservations({}));
  const [reservationBookId, setReservationBookId] = useState("");
  const [reservationBorrowerType, setReservationBorrowerType] = useState<"student" | "employee">("student");
  const [reservationStudentId, setReservationStudentId] = useState("");
  const [reservationEmployeeId, setReservationEmployeeId] = useState("");

  // ── Settings & reports ────────────────────────────────────────────
  const settings = useSWR("library-settings", () => api.getLibrarySettings());
  const [settingsForm, setSettingsForm] = useState<{ loanPeriodDays: string; finePerDayRate: string; maxActiveLoans: string } | null>(null);
  const overdue = useSWR("library-overdue", () => api.getLibraryOverdueReport());
  const mostBorrowed = useSWR("library-most-borrowed", () => api.getLibraryMostBorrowedReport());

  const s = settingsForm ?? (settings.data
    ? {
        loanPeriodDays: String(settings.data.loanPeriodDays),
        finePerDayRate: String(settings.data.finePerDayRate),
        maxActiveLoans: String(settings.data.maxActiveLoans),
      }
    : null);

  function refreshCirculation() {
    openTransactions.mutate();
    fines.mutate();
    reservations.mutate();
    refreshBookLists();
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-muted-foreground text-sm">
          Catalog, circulation, fines, reservations, and reports — native to this ERP, no separate login.
        </p>
      </div>

      <PageSubNav
        sections={[
          { id: "categories", label: "Categories" },
          { id: "books", label: "Books" },
          { id: "circulation", label: "Circulation" },
          { id: "fines", label: "Fines" },
          { id: "reservations", label: "Reservations" },
          { id: "reports", label: "Reports" },
          { id: "settings", label: "Settings" },
        ]}
      />

      {/* ── Categories ───────────────────────────────────────────── */}
      <Card id="categories" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!categories.data || categories.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No categories yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {categories.data.map((c) =>
                editingCategoryId === c.id ? (
                  <li key={c.id} className="py-2">
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        submitAction(
                          () => api.updateBookCategory(c.id, editCategoryForm),
                          () => {
                            setEditingCategoryId(null);
                            categories.mutate();
                          },
                        );
                      }}
                    >
                      <Input className="h-7 w-40" value={editCategoryForm.name} onChange={(e) => setEditCategoryForm((f) => ({ ...f, name: e.target.value }))} />
                      <Input className="h-7 w-28" value={editCategoryForm.code} onChange={(e) => setEditCategoryForm((f) => ({ ...f, code: e.target.value }))} />
                      <Button type="submit" size="sm" className="h-7">
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingCategoryId(null)}>
                        Cancel
                      </Button>
                    </form>
                  </li>
                ) : (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {c.name} <span className="text-muted-foreground">({c.code})</span>
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCategoryId(c.id);
                          setEditCategoryForm({ name: c.name, code: c.code });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => submitDelete(() => api.deleteBookCategory(c.id), () => categories.mutate())}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () => api.createBookCategory(categoryForm),
                () => {
                  setCategoryForm({ name: "", code: "" });
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
              <Label className="text-xs">Code</Label>
              <Input className="w-28" value={categoryForm.code} onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" disabled={!categoryForm.name || !categoryForm.code}>
              Add category
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Books ────────────────────────────────────────────────── */}
      <Card id="books" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Books</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!books.data || books.data.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No books yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {books.data.data.map((b) =>
                editingBookId === b.id ? (
                  <li key={b.id} className="py-2">
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        submitAction(
                          () =>
                            api.updateBook(b.id, {
                              ...editBookForm,
                              categoryId: editBookForm.categoryId || undefined,
                              totalCopies: Number(editBookForm.totalCopies) || undefined,
                            }),
                          () => {
                            setEditingBookId(null);
                            refreshBookLists();
                          },
                        );
                      }}
                    >
                      <Input className="h-7 w-48" value={editBookForm.title} onChange={(e) => setEditBookForm((f) => ({ ...f, title: e.target.value }))} />
                      <Input className="h-7 w-32" placeholder="ISBN" value={editBookForm.isbn} onChange={(e) => setEditBookForm((f) => ({ ...f, isbn: e.target.value }))} />
                      <Input className="h-7 w-36" placeholder="Author" value={editBookForm.author} onChange={(e) => setEditBookForm((f) => ({ ...f, author: e.target.value }))} />
                      <NativeSelect
                        className="h-7 w-36"
                        placeholder="Category"
                        value={editBookForm.categoryId}
                        onChange={(v) => setEditBookForm((f) => ({ ...f, categoryId: v }))}
                        options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                      />
                      <Input
                        type="number"
                        className="h-7 w-20"
                        placeholder="Copies"
                        value={editBookForm.totalCopies}
                        onChange={(e) => setEditBookForm((f) => ({ ...f, totalCopies: e.target.value }))}
                      />
                      <Button type="submit" size="sm" className="h-7">
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingBookId(null)}>
                        Cancel
                      </Button>
                    </form>
                  </li>
                ) : (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{b.title}</span>{" "}
                      <span className="text-muted-foreground">
                        — {b.isbn ?? "no ISBN"} · {b.author ?? "unknown author"} · {b.category?.name ?? "uncategorized"} ·{" "}
                        {b.availableCopies}/{b.totalCopies} available
                      </span>
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBookId(b.id);
                          setEditBookForm({
                            title: b.title,
                            isbn: b.isbn ?? "",
                            author: b.author ?? "",
                            publisher: b.publisher ?? "",
                            edition: b.edition ?? "",
                            coverImageUrl: b.coverImageUrl ?? "",
                            categoryId: b.categoryId ?? "",
                            shelfLocation: b.shelfLocation ?? "",
                            totalCopies: String(b.totalCopies),
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => submitDelete(() => api.deleteBook(b.id), refreshBookLists)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
          {books.data ? (
            <ListPager
              page={books.data.page}
              totalPages={books.data.totalPages}
              onPrev={() => setBooksPage((p) => Math.max(1, p - 1))}
              onNext={() => setBooksPage((p) => p + 1)}
            />
          ) : null}
          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Minimal entry — ISBN lookup or scan a cover</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">ISBN</Label>
                <Input
                  className="w-40"
                  placeholder="978..."
                  value={isbnLookupValue}
                  onChange={(e) => setIsbnLookupValue(e.target.value)}
                />
              </div>
              <Button type="button" size="sm" variant="outline" disabled={!isbnLookupValue || isbnLookingUp} onClick={lookupIsbn}>
                {isbnLookingUp ? "Looking up…" : "Look up ISBN"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCoverScan((s) => !s)}>
                {showCoverScan ? "Cancel scan" : "Scan cover"}
              </Button>
              <label className="text-muted-foreground flex h-8 cursor-pointer items-center text-xs underline">
                or upload a cover photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) scanCover(file);
                  }}
                />
              </label>
              {scanningCover ? <span className="text-muted-foreground text-xs">Reading cover…</span> : null}
            </div>
            {showCoverScan ? <CameraCapture onCapture={({ blob }) => scanCover(new File([blob], "cover.jpg", { type: "image/jpeg" }))} /> : null}
          </div>

          <Separator />
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createBook({
                    ...bookForm,
                    categoryId: bookForm.categoryId || undefined,
                    totalCopies: Number(bookForm.totalCopies) || 1,
                  }),
                () => {
                  setBookForm(EMPTY_BOOK_FORM);
                  refreshBookLists();
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
              <Input className="w-32" value={bookForm.isbn} onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Author</Label>
              <Input className="w-36" value={bookForm.author} onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <NativeSelect
                className="w-36"
                placeholder="Uncategorized"
                value={bookForm.categoryId}
                onChange={(v) => setBookForm((f) => ({ ...f, categoryId: v }))}
                options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Copies</Label>
              <Input type="number" className="w-20" value={bookForm.totalCopies} onChange={(e) => setBookForm((f) => ({ ...f, totalCopies: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" disabled={!bookForm.title}>
              Add book
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Circulation ──────────────────────────────────────────── */}
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
                <PersonPicker className="w-64" placeholder="Select book" value={issueBookId} onChange={setIssueBookId} options={bookOptions} />
              </div>
              <BorrowerField
                type={issueBorrowerType}
                onTypeChange={setIssueBorrowerType}
                studentId={issueStudentId}
                employeeId={issueEmployeeId}
                onStudentChange={setIssueStudentId}
                onEmployeeChange={setIssueEmployeeId}
                studentOptions={studentOptions}
                employeeOptions={employeeOptions}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => setShowIssueFaceCapture((s) => !s)}>
                {showIssueFaceCapture ? "Cancel verification" : issueFaceImageBase64 ? "Recapture" : "Verify identity (face)"}
              </Button>
              <label className="flex h-8 items-center gap-1.5 text-xs">
                <input type="checkbox" checked={issueManualOverride} onChange={(e) => setIssueManualOverride(e.target.checked)} />
                Manual override
              </label>
              <Button
                type="button"
                size="sm"
                disabled={!issueBookId || (issueBorrowerType === "student" ? !issueStudentId : !issueEmployeeId)}
                onClick={() =>
                  submitAction(
                    () =>
                      api.issueBook({
                        bookId: issueBookId,
                        studentId: issueBorrowerType === "student" ? issueStudentId : undefined,
                        employeeId: issueBorrowerType === "employee" ? issueEmployeeId : undefined,
                        faceImageBase64: issueFaceImageBase64 ?? undefined,
                        manualOverride: issueManualOverride,
                      }),
                    () => {
                      setIssueBookId("");
                      setIssueStudentId("");
                      setIssueEmployeeId("");
                      setIssueFaceImageBase64(null);
                      setIssueManualOverride(false);
                      setShowIssueFaceCapture(false);
                      refreshCirculation();
                    },
                    "Issued",
                  )
                }
              >
                Issue
              </Button>
            </div>
            {showIssueFaceCapture ? (
              <CameraCapture
                onCapture={async ({ blob }) => {
                  setIssueFaceImageBase64(await blobToBase64(blob));
                  setShowIssueFaceCapture(false);
                }}
              />
            ) : issueFaceImageBase64 ? (
              <p className="text-muted-foreground text-xs">Face captured — will be checked against the borrower&apos;s enrolled template.</p>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Open loans</p>
            {!openTransactions.data || openTransactions.data.length === 0 ? (
              <p className="text-muted-foreground text-sm">None.</p>
            ) : (
              <ul className="divide-y text-sm">
                {openTransactions.data.map((t: LibraryTransactionRecord) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {t.book.title} — {borrowerLabel(t)}{" "}
                      <span className="text-muted-foreground">due {new Date(t.dueDate).toLocaleDateString()}</span>
                      {t.issueFaceVerified ? (
                        <Badge variant={t.issueFaceVerified === "MATCHED" ? "success" : "secondary"} className="ml-1">
                          {t.issueFaceVerified}
                        </Badge>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        submitAction(() => api.returnBook(t.id), refreshCirculation, "Returned")
                      }
                    >
                      Return
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Fines ────────────────────────────────────────────────── */}
      <Card id="fines" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Fines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect
            className="w-36"
            placeholder="All"
            value={fineStatusFilter}
            onChange={(v) => setFineStatusFilter(v as "PENDING" | "PAID" | "WAIVED" | "")}
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "PAID", label: "Paid" },
              { value: "WAIVED", label: "Waived" },
            ]}
          />
          {!fines.data || fines.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No fines.</p>
          ) : (
            <ul className="divide-y text-sm">
              {fines.data.map((f: LibraryFineRecord) => (
                <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {borrowerLabel(f)} — NPR {Number(f.amount).toFixed(2)} ({f.reason})
                    {" "}
                    <Badge variant={f.status === "PAID" ? "success" : f.status === "WAIVED" ? "secondary" : "warning"}>
                      {f.status}
                    </Badge>
                    {f.invoiceId ? <span className="text-muted-foreground text-xs"> · posted as invoice</span> : null}
                  </span>
                  {f.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => submitAction(() => api.payLibraryFine(f.id), () => fines.mutate(), "Marked paid")}>
                        Mark paid
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => submitAction(() => api.waiveLibraryFine(f.id), () => fines.mutate(), "Waived")}>
                        Waive
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <p className="text-sm font-medium">Record a manual fine (lost / damaged)</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submitAction(
                () =>
                  api.createLibraryFine({
                    studentId: fineBorrowerType === "student" ? fineStudentId : undefined,
                    employeeId: fineBorrowerType === "employee" ? fineEmployeeId : undefined,
                    reason: fineForm.reason,
                    amount: Number(fineForm.amount),
                  }),
                () => {
                  setFineForm({ bookId: "", reason: "LOST", amount: "" });
                  setFineStudentId("");
                  setFineEmployeeId("");
                  fines.mutate();
                },
                "Fine recorded",
              );
            }}
          >
            <BorrowerField
              type={fineBorrowerType}
              onTypeChange={setFineBorrowerType}
              studentId={fineStudentId}
              employeeId={fineEmployeeId}
              onStudentChange={setFineStudentId}
              onEmployeeChange={setFineEmployeeId}
              studentOptions={studentOptions}
              employeeOptions={employeeOptions}
            />
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <NativeSelect
                className="w-28"
                placeholder="Reason"
                value={fineForm.reason}
                onChange={(v) => setFineForm((f) => ({ ...f, reason: v as "LOST" | "DAMAGED" }))}
                options={[
                  { value: "LOST", label: "Lost" },
                  { value: "DAMAGED", label: "Damaged" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (NPR)</Label>
              <Input type="number" className="w-28" value={fineForm.amount} onChange={(e) => setFineForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!fineForm.amount || (fineBorrowerType === "student" ? !fineStudentId : !fineEmployeeId)}
            >
              Record fine
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Reservations ─────────────────────────────────────────── */}
      <Card id="reservations" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!reservations.data || reservations.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reservations.</p>
          ) : (
            <ul className="divide-y text-sm">
              {reservations.data.map((r: LibraryReservationRecord) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {r.book.title} — {borrowerLabel(r)}{" "}
                    <Badge variant={r.status === "READY" ? "success" : r.status === "PENDING" ? "secondary" : "outline"}>
                      {r.status}
                    </Badge>
                  </span>
                  {r.status === "PENDING" || r.status === "READY" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => submitAction(() => api.cancelLibraryReservation(r.id), () => reservations.mutate(), "Cancelled")}
                    >
                      Cancel
                    </Button>
                  ) : null}
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
                () =>
                  api.createLibraryReservation({
                    bookId: reservationBookId,
                    studentId: reservationBorrowerType === "student" ? reservationStudentId : undefined,
                    employeeId: reservationBorrowerType === "employee" ? reservationEmployeeId : undefined,
                  }),
                () => {
                  setReservationBookId("");
                  setReservationStudentId("");
                  setReservationEmployeeId("");
                  reservations.mutate();
                },
                "Reserved",
              );
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Book</Label>
              <PersonPicker className="w-64" placeholder="Select book" value={reservationBookId} onChange={setReservationBookId} options={bookOptions} />
            </div>
            <BorrowerField
              type={reservationBorrowerType}
              onTypeChange={setReservationBorrowerType}
              studentId={reservationStudentId}
              employeeId={reservationEmployeeId}
              onStudentChange={setReservationStudentId}
              onEmployeeChange={setReservationEmployeeId}
              studentOptions={studentOptions}
              employeeOptions={employeeOptions}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!reservationBookId || (reservationBorrowerType === "student" ? !reservationStudentId : !reservationEmployeeId)}
            >
              Reserve
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Reports ──────────────────────────────────────────────── */}
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
                    {r.book.title} — {borrowerLabel(r)}{" "}
                    <span className="text-muted-foreground">due {new Date(r.dueDate).toLocaleDateString()}</span>
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
                    {row.book?.title ?? "Unknown"} — {row.borrowCount} loan{row.borrowCount === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Settings ─────────────────────────────────────────────── */}
      <Card id="settings" className="scroll-mt-16">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {s ? (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                submitAction(
                  () =>
                    api.updateLibrarySettings({
                      loanPeriodDays: Number(s.loanPeriodDays),
                      finePerDayRate: Number(s.finePerDayRate),
                      maxActiveLoans: Number(s.maxActiveLoans),
                    }),
                  () => settings.mutate(),
                );
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Loan period (days)</Label>
                <Input type="number" className="w-28" value={s.loanPeriodDays} onChange={(e) => setSettingsForm({ ...s, loanPeriodDays: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fine per day (NPR)</Label>
                <Input type="number" className="w-28" value={s.finePerDayRate} onChange={(e) => setSettingsForm({ ...s, finePerDayRate: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max active loans</Label>
                <Input type="number" className="w-28" value={s.maxActiveLoans} onChange={(e) => setSettingsForm({ ...s, maxActiveLoans: e.target.value })} />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
