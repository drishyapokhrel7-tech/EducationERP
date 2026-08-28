import { getLibraryMemberAccessToken, getLibraryStaffAccessToken } from "./library-auth-storage";

// A separate, purpose-built client for ~/librarysystem's own REST API —
// deliberately NOT built on @education-erp/api-client's createApiClient,
// since that factory's ~250 methods are hardcoded to this project's own
// route/type surface and would be meaningless against a different
// backend. Same fetch-wrapper shape (Bearer token, ApiError on non-2xx)
// so the request pattern still feels familiar.
//
// Parameterized by a token getter and instantiated twice (below) — one
// bound to the staff session, one to the member session — rather than a
// single client reading one ambiguous token. A shared client would let a
// staff-signed-in browser silently reuse that token on the student
// portal, rendering staff-wide data as if it were "my own" loans/fines.

const BASE_URL = process.env.NEXT_PUBLIC_LIBRARY_API_URL ?? "http://localhost:4100/api";

export class LibraryApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Library API request failed with status ${status}`);
  }
}

// ── Types (local — nothing else in this monorepo needs these) ─────────

export interface LibraryLoginResult {
  accessToken: string;
  user: { id: number; name: string; role: "MEMBER" | "LIBRARIAN" | "ADMINISTRATOR" };
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface BookAuthor {
  id: number;
  name: string;
  nationality: string | null;
}

export interface Book {
  id: number;
  title: string;
  isbn: string | null;
  categoryId: number | null;
  publisher: string | null;
  edition: string | null;
  copies: number;
  availableCopies: number;
  status: "ACTIVE" | "WITHDRAWN" | "UNDER_REPAIR";
  entryMethod: "ISBN_SCAN" | "OCR" | "MANUAL";
  coverImageUrl: string | null;
  category: Category | null;
  authors: BookAuthor[];
}

export interface Member {
  id: number;
  name: string;
  type: "STUDENT" | "FACULTY" | "GENERAL";
  contact: string | null;
  address: string | null;
  joinDate: string;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  erpRefId: string | null;
  username: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  bookId: number;
  memberId: number;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  issueFaceVerified: string | null;
  returnFaceVerified: string | null;
  book: Book;
  member: Member;
  fine: Fine | null;
}

export interface Fine {
  id: number;
  transactionId: number;
  amount: string;
  paidStatus: "UNPAID" | "PAID";
  erpInvoiceId: string | null;
  createdAt: string;
}

export interface Reservation {
  id: number;
  bookId: number;
  memberId: number;
  reservedAt: string;
  readyAt: string | null;
  fulfilled: boolean;
  book: Book;
  member: Member;
}

export interface SystemConfig {
  id: number;
  finePerDayRate: string;
  faceMatchConfidenceMin: number;
  loanPeriodDays: number;
  erpFeePostingEnabled: boolean;
}

export interface IsbnLookupResult {
  title?: string;
  isbn?: string;
  publisher?: string;
  authors?: string[];
}

export interface OcrScanResult {
  title?: string;
  author?: string;
  lowConfidence: boolean;
}

export interface FaceVerificationOutcome {
  outcome: "MATCHED" | "MANUAL_OVERRIDE" | "UNAVAILABLE" | "NOT_ENROLLED";
}

export interface MostBorrowedRow {
  book: Book;
  borrowCount: number;
}

export interface FineCollectionReport {
  from: string | null;
  to: string | null;
  countAssessed: number;
  totalAssessed: number;
  countCollected: number;
  totalCollected: number;
  countOutstanding: number;
  totalOutstanding: number;
}

export interface RosterSyncResult {
  studentsFound: number;
  employeesFound: number;
  created: number;
  updated: number;
  suspended: number;
}


function createLibraryApiClient(getAccessToken: () => string | null) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) throw new LibraryApiError(res.status, body);
    return body as T;
  }

  async function requestForm<T>(path: string, form: FormData, method: "POST" | "PATCH" = "POST"): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { method, body: form, headers });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new LibraryApiError(res.status, body);
    return body as T;
  }

  return {
  // ── Auth ──────────────────────────────────────────────────────────
  erpLogin: (identifier: string, password: string) =>
    request<LibraryLoginResult>("/auth/erp-login", { method: "POST", body: JSON.stringify({ identifier, password }) }),
  // Silent-SSO variant — bridges an already-issued ERP access token
  // instead of asking the admin to retype their password. See
  // dashboard/library/page.tsx for where this is tried first.
  erpTokenLogin: (accessToken: string) =>
    request<LibraryLoginResult>("/auth/erp-token-login", { method: "POST", body: JSON.stringify({ accessToken }) }),
  staffLogin: (username: string, password: string) =>
    request<LibraryLoginResult>("/auth/staff/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  // ── Catalogue ─────────────────────────────────────────────────────
  listCategories: () => request<Category[]>("/categories"),
  createCategory: (input: { name: string; description?: string }) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(input) }),
  searchBooks: (q?: string) => request<Book[]>(`/books${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getBook: (id: number) => request<Book>(`/books/${id}`),
  createBook: (input: {
    title: string;
    isbn?: string;
    categoryId?: number;
    publisher?: string;
    edition?: string;
    copies?: number;
    coverImageUrl?: string;
    entryMethod?: "ISBN_SCAN" | "OCR" | "MANUAL";
    authors?: { name: string; nationality?: string }[];
  }) => request<Book>("/books", { method: "POST", body: JSON.stringify(input) }),
  isbnLookup: (isbn: string) => request<IsbnLookupResult>(`/catalogue/isbn-lookup/${encodeURIComponent(isbn)}`),
  ocrScan: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return requestForm<OcrScanResult>("/catalogue/ocr-scan", form);
  },

  // ── Membership ────────────────────────────────────────────────────
  listMembers: () => request<Member[]>("/members"),
  getMember: (id: number) => request<Member>(`/members/${id}`),
  enrollFaceTemplate: (id: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return requestForm<{ enrolled: true; detectionConfidence: number }>(`/members/${id}/face-template`, form);
  },

  // ── Circulation ───────────────────────────────────────────────────
  listTransactions: (params: { memberId?: number; bookId?: number; open?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.memberId != null) q.set("memberId", String(params.memberId));
    if (params.bookId != null) q.set("bookId", String(params.bookId));
    if (params.open != null) q.set("open", String(params.open));
    const qs = q.toString();
    return request<Transaction[]>(`/circulation/transactions${qs ? `?${qs}` : ""}`);
  },
  issueBook: (input: { bookId: number; memberId: number; faceImageBase64?: string; manualOverride?: boolean }) =>
    request<Transaction>("/circulation/issue", { method: "POST", body: JSON.stringify(input) }),
  returnBook: (input: { transactionId: number; faceImageBase64?: string; manualOverride?: boolean }) =>
    request<Transaction>("/circulation/return", { method: "POST", body: JSON.stringify(input) }),

  // ── Fines ─────────────────────────────────────────────────────────
  listFines: (params: { memberId?: number; paidStatus?: "UNPAID" | "PAID" } = {}) => {
    const q = new URLSearchParams();
    if (params.memberId != null) q.set("memberId", String(params.memberId));
    if (params.paidStatus) q.set("paidStatus", params.paidStatus);
    const qs = q.toString();
    return request<Fine[]>(`/fines${qs ? `?${qs}` : ""}`);
  },
  payFine: (id: number) => request<Fine>(`/fines/${id}/pay`, { method: "PATCH" }),
  postFineToErp: (id: number) => request<Fine>(`/fines/${id}/post-to-erp`, { method: "POST" }),

  // ── Reservations ──────────────────────────────────────────────────
  listReservations: (params: { memberId?: number; bookId?: number; pending?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.memberId != null) q.set("memberId", String(params.memberId));
    if (params.bookId != null) q.set("bookId", String(params.bookId));
    if (params.pending != null) q.set("pending", String(params.pending));
    const qs = q.toString();
    return request<Reservation[]>(`/reservations${qs ? `?${qs}` : ""}`);
  },
  createReservation: (input: { bookId: number; memberId?: number }) =>
    request<Reservation>("/reservations", { method: "POST", body: JSON.stringify(input) }),
  cancelReservation: (id: number) => request<void>(`/reservations/${id}`, { method: "DELETE" }),

  // ── System config ─────────────────────────────────────────────────
  getSystemConfig: () => request<SystemConfig>("/system-config"),
  updateSystemConfig: (input: {
    finePerDayRate?: number;
    faceMatchConfidenceMin?: number;
    loanPeriodDays?: number;
    erpFeePostingEnabled?: boolean;
  }) => request<SystemConfig>("/system-config", { method: "PATCH", body: JSON.stringify(input) }),

  // ── Reports ───────────────────────────────────────────────────────
  getOverdueReport: (asOf?: string) => request<Transaction[]>(`/reports/overdue${asOf ? `?asOf=${asOf}` : ""}`),
  getMostBorrowedReport: (params: { from?: string; to?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<MostBorrowedRow[]>(`/reports/most-borrowed${qs ? `?${qs}` : ""}`);
  },
  getFineCollectionReport: (params: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    const qs = q.toString();
    return request<FineCollectionReport>(`/reports/fine-collection${qs ? `?${qs}` : ""}`);
  },

  // ── ERP sync ──────────────────────────────────────────────────────
  syncRoster: () => request<RosterSyncResult>("/erp/sync-roster", { method: "POST" }),
  };
}

// Dashboard (staff) and portal (member) each get their own client bound
// to their own session — see the class doc above for why these must
// never be merged into one.
export const libraryStaffApi = createLibraryApiClient(getLibraryStaffAccessToken);
export const libraryMemberApi = createLibraryApiClient(getLibraryMemberAccessToken);
