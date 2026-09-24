import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, PrismaClient, type FaceVerifiedOutcome } from "@prisma/client";
import { recognizeCover } from "./ocr-direct";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { assertNoDependents } from "../../common/assert-no-dependents";
import { paginate } from "../../common/pagination";
import { CreateBookCategoryDto } from "./dto/create-book-category.dto";
import { UpdateBookCategoryDto } from "./dto/update-book-category.dto";
import { CreateBookDto } from "./dto/create-book.dto";
import { UpdateBookDto } from "./dto/update-book.dto";
import { IssueBookDto } from "./dto/issue-book.dto";
import { CreateFineDto } from "./dto/create-fine.dto";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { UpdateLibrarySettingsDto } from "./dto/update-library-settings.dto";

const DEFAULT_SETTINGS = { loanPeriodDays: 14, finePerDayRate: 5, maxActiveLoans: 3 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function borrowerDisplayName(t: {
  student: { firstName: string; lastName: string } | null;
  employee: { firstName: string; lastName: string } | null;
}): string {
  const person = t.student ?? t.employee;
  return person ? `${person.firstName} ${person.lastName}` : "Unknown borrower";
}

/**
 * Native Library module — this ERP's own Book/circulation/fine/
 * reservation data (~librarysystem's design used only as a feature
 * reference, not consumed over the network). Borrower is a nullable
 * (studentId, employeeId) pair, exactly one set, same shape precedent as
 * TeachingAssignment's nullable (sectionId, programId) pair.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  // ── Categories ────────────────────────────────────────────────────

  createCategory(organizationId: string, dto: CreateBookCategoryDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.bookCategory.create({ data: { organizationId, name: dto.name, code: dto.code } }),
    );
  }

  listCategories(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.bookCategory.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  async updateCategory(organizationId: string, id: string, dto: UpdateBookCategoryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCategory(tx, organizationId, id);
      return tx.bookCategory.update({ where: { id }, data: dto });
    });
  }

  async deleteCategory(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCategory(tx, organizationId, id);
      await assertNoDependents([tx.book.count({ where: { categoryId: id } })], "book category");
      await tx.bookCategory.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // ── Books ─────────────────────────────────────────────────────────

  async createBook(organizationId: string, dto: CreateBookDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      if (dto.categoryId) await this.loadCategory(tx, organizationId, dto.categoryId);
      const totalCopies = dto.totalCopies ?? 1;
      return tx.book.create({
        data: {
          organizationId,
          categoryId: dto.categoryId,
          title: dto.title,
          isbn: dto.isbn,
          author: dto.author,
          publisher: dto.publisher,
          edition: dto.edition,
          shelfLocation: dto.shelfLocation,
          coverImageUrl: dto.coverImageUrl,
          totalCopies,
          availableCopies: totalCopies,
        },
      });
    });
  }

  listBooks(organizationId: string, page: number, pageSize: number) {
    return this.prisma.withTenant(organizationId, (tx) => {
      const where = { organizationId };
      return paginate(
        () =>
          tx.book.findMany({
            where,
            include: { category: true },
            orderBy: { title: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        () => tx.book.count({ where }),
        page,
        pageSize,
      );
    });
  }

  // Deliberately separate from the paginated listBooks above — same
  // "unbounded, narrow picker" precedent as StudentsService.
  // listStudentsPicker, used for the issue/reserve form's book combobox
  // and the portal's own catalog search.
  listBooksPicker(organizationId: string, query?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.book.findMany({
        where: query
          ? {
              organizationId,
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { author: { contains: query, mode: "insensitive" } },
                { isbn: { contains: query, mode: "insensitive" } },
              ],
            }
          : { organizationId },
        include: { category: true },
        orderBy: { title: "asc" },
        take: 50,
      }),
    );
  }

  async updateBook(organizationId: string, id: string, dto: UpdateBookDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const book = await this.loadBook(tx, organizationId, id);
      if (dto.categoryId) await this.loadCategory(tx, organizationId, dto.categoryId);

      let availableCopies = book.availableCopies;
      if (dto.totalCopies !== undefined && dto.totalCopies !== book.totalCopies) {
        const delta = dto.totalCopies - book.totalCopies;
        availableCopies = book.availableCopies + delta;
        if (availableCopies < 0) {
          throw new ConflictException(
            "Cannot lower total copies below the number currently on loan — return outstanding copies first",
          );
        }
      }

      const { totalCopies, ...rest } = dto;
      return tx.book.update({
        where: { id },
        data: { ...rest, ...(totalCopies !== undefined ? { totalCopies, availableCopies } : {}) },
      });
    });
  }

  async deleteBook(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadBook(tx, organizationId, id);
      await assertNoDependents(
        [
          tx.libraryTransaction.count({ where: { bookId: id, returnedAt: null } }),
          tx.libraryReservation.count({ where: { bookId: id, status: { in: ["PENDING", "READY"] } } }),
        ],
        "book",
      );
      await tx.book.delete({ where: { id } });
      return { deleted: true };
    });
  }

  // ── Minimal data entry: ISBN lookup + OCR cover scan ───────────────
  // Both are preview-only — neither writes a Book, they just return a
  // best-effort {title, author, publisher, coverImageUrl} for the
  // caller's add-book form to prefill and let staff review before
  // saving, same "never auto-submit" precedent as every other
  // OCR/lookup-assisted entry flow (e.g. librarysystem's own Phase 5,
  // used as this feature's design reference).

  // Open Library is public, keyed by a global cache (IsbnLookupCache has
  // no organizationId — an ISBN means the same book everywhere) so a
  // second org's lookup of the same ISBN never re-hits the network. A
  // successful-but-empty API response is a real "not found," not a
  // failure — only a genuine network/HTTP failure falls back to the
  // cache.
  //
  // Uses /isbn/{isbn}.json (redirects to the edition record), not
  // Open Library's older /api/books?bibkeys=...&jscmd=data endpoint —
  // that one was found, during testing with a real Nepal-registered
  // ISBN, to 404 for editions that genuinely exist and have full data
  // via this endpoint (confirmed even for the isbn Open Library's own
  // API docs use as their example, so this isn't Nepal-specific — that
  // whole endpoint looks degraded). The tradeoff: this endpoint returns
  // authors as bare {key} references rather than resolved names, so
  // each author needs its own follow-up fetch.
  async isbnLookup(isbn: string) {
    const normalized = isbn.replace(/[\s-]/g, "");
    if (!normalized) throw new BadRequestException("Provide an ISBN");

    let apiResult: { title?: string; author?: string; publisher?: string; coverImageUrl?: string } | undefined;
    let apiReachable = true;
    try {
      const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(normalized)}.json`);
      // A genuinely unknown ISBN 404s (an HTML error page, not JSON —
      // checked before ever calling res.json() below). That's a real
      // "not found," not a service failure.
      if (!res.ok && res.status !== 404) throw new Error(`status ${res.status}`);
      if (res.ok) {
        const edition = (await res.json()) as {
          title?: string;
          authors?: { key: string }[];
          publishers?: string[];
          covers?: number[];
        };
        const authorNames = await Promise.all(
          (edition.authors ?? []).map(async (a) => {
            try {
              const authorRes = await fetch(`https://openlibrary.org${a.key}.json`);
              if (!authorRes.ok) return null;
              const author = (await authorRes.json()) as { name?: string };
              return author.name ?? null;
            } catch {
              // One author's name failing to resolve shouldn't sink the
              // whole lookup — the title/publisher/cover are still real.
              return null;
            }
          }),
        );
        apiResult = {
          title: edition.title,
          author: authorNames.filter((n): n is string => n !== null).join(", ") || undefined,
          publisher: edition.publishers?.join(", "),
          coverImageUrl: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-M.jpg` : undefined,
        };
      }
    } catch {
      apiReachable = false;
    }

    if (apiResult) {
      const saved = await this.prisma.isbnLookupCache.upsert({
        where: { isbn: normalized },
        update: { ...apiResult, fetchedAt: new Date() },
        create: { isbn: normalized, ...apiResult },
      });
      return saved;
    }
    if (!apiReachable) {
      const cached = await this.prisma.isbnLookupCache.findUnique({ where: { isbn: normalized } });
      if (cached) return cached;
      throw new ServiceUnavailableException("ISBN lookup service is unreachable and no cached result exists");
    }
    throw new NotFoundException("No book found for this ISBN");
  }

  // Deliberately simple heuristic, not a real layout-analysis model —
  // matches the reference implementation exactly: the longest of the
  // first several non-empty lines is taken as the title (cover titles
  // are almost always the largest/most prominent text block), a line
  // starting with "by " is the author. lowConfidence flags a guess
  // that's more likely wrong than right, so the caller's form can
  // still show it (never a dead end) while visually flagging "check
  // this."
  //
  // Publisher/edition/ISBN are searched across every recognized line,
  // not just the title/author window — a publisher imprint or edition
  // line is often set apart from the title block (bottom of the cover,
  // a separate logo line), and a front-cover ISBN can land anywhere
  // relative to the first few lines. Each is only ever taken from an
  // explicit, low-ambiguity marker (a "Published by"/"Publisher:"
  // prefix, an "Nth Edition" phrase, an "ISBN" label) — never guessed
  // from an unlabeled short line, which would trade a null (safe,
  // obviously "not found") for a wrong guess silently written into the
  // form.
  async ocrScanCover(buffer: Buffer) {
    const { text, confidence } = await recognizeCover(buffer);
    const allLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const lines = allLines.slice(0, 8);

    // Each field is matched in English and Nepali (Devanagari) — the OCR
    // itself now reads both scripts (see ocr-direct.ts), but recognizing
    // a line's characters correctly doesn't mean knowing what it *is*:
    // "लेखक:" ("author:") isn't English "by ", so without a matching
    // Nepali marker a correctly-OCR'd Nepali author line was falling
    // through to the "longest line wins" title heuristic — a title
    // regression on a mixed-script cover even though every character
    // was read right. ः (Devanagari visarga) is included alongside the
    // plain colon since covers use both stylistically for these labels.
    const authorPatternEn = /^by\s+/i;
    // eslint-disable-next-line no-misleading-character-class -- ः (Devanagari visarga, U+0903) is a real, standalone character used here as one alternative separator alongside ":"/"-", not a misplaced combining diacritic
    const authorPatternNe = /^(लेखक|लेखिका)[:ः\-\s]*/;
    const publisherPatternEn = /^(published by|publisher:?)\s+/i;
    // eslint-disable-next-line no-misleading-character-class -- same standalone-visarga-as-separator reasoning as authorPatternNe above
    const publisherPatternNe = /^(प्रकाशक|प्रकाशन)[:ः\-\s]*/;
    const editionPatternEn = /\b(\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+edition\b/i;
    // A leading ordinal word (पहिलो/दोस्रो/...) is optional and captured
    // loosely rather than enumerated — Devanagari ordinals inflect in
    // ways not worth hand-listing here — "संस्करण" alone is still a
    // reliable, low-ambiguity edition marker on its own.
    const editionPatternNe = /(\S+\s+)?संस्करण/;
    const isbnPattern = /isbn(?:-1[03])?[:\s-]*([0-9][0-9\- ]{8,16}[0-9xX])/i;

    const isAuthorLine = (l: string) => authorPatternEn.test(l) || authorPatternNe.test(l);
    const stripAuthorPrefix = (l: string) => l.replace(authorPatternEn, "").replace(authorPatternNe, "").trim();
    const isPublisherLine = (l: string) => publisherPatternEn.test(l) || publisherPatternNe.test(l);
    const stripPublisherPrefix = (l: string) => l.replace(publisherPatternEn, "").replace(publisherPatternNe, "").trim();
    const isEditionLine = (l: string) => editionPatternEn.test(l) || editionPatternNe.test(l);

    // A line claimed by one of the other fields is never also title
    // material — without this, e.g. an "ISBN: 978-..." line (often the
    // single longest line on a cover) would win the "longest line"
    // title heuristic outright.
    const isMetadataLine = (l: string) => isAuthorLine(l) || isPublisherLine(l) || isEditionLine(l) || isbnPattern.test(l);

    const authorLine = lines.find(isAuthorLine);
    const author = authorLine ? stripAuthorPrefix(authorLine) || null : null;
    const titleCandidates = lines.filter((l) => !isMetadataLine(l));
    const title = titleCandidates.reduce<string | null>(
      (longest, line) => (line.length > (longest?.length ?? 0) ? line : longest),
      null,
    );

    const publisherLine = allLines.find(isPublisherLine);
    const publisher = publisherLine ? stripPublisherPrefix(publisherLine) || null : null;

    const editionMatch = allLines.map((l) => l.match(editionPatternEn) ?? l.match(editionPatternNe)).find((m): m is RegExpMatchArray => m !== null);
    const edition = editionMatch ? editionMatch[0].trim() : null;

    const isbnMatch = allLines.map((l) => l.match(isbnPattern)).find((m): m is RegExpMatchArray => m !== null);
    const isbn = isbnMatch ? isbnMatch[1].replace(/[^0-9xX]/g, "") : null;

    const lowConfidence = confidence < 60 || lines.length === 0;
    return { title, author, publisher, edition, isbn, lowConfidence };
  }

  // ── Circulation ───────────────────────────────────────────────────

  async issueBook(organizationId: string, issuedByUserId: string, dto: IssueBookDto) {
    if (!dto.studentId === !dto.employeeId) {
      throw new BadRequestException("Provide exactly one of studentId or employeeId");
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      const book = await this.loadBook(tx, organizationId, dto.bookId);
      if (book.availableCopies <= 0) throw new ConflictException("No copies of this book are currently available");

      const borrower = await this.resolveBorrower(tx, organizationId, dto);

      let issueFaceVerified: FaceVerifiedOutcome | undefined;
      if (dto.faceImageBase64) {
        const { outcome, similarity } = await this.verifyBorrowerFace(tx, organizationId, borrower, dto.faceImageBase64);
        if (outcome === "MATCHED") {
          issueFaceVerified = "MATCHED";
        } else if (dto.manualOverride) {
          issueFaceVerified = "MANUAL_OVERRIDE";
        } else {
          const similarityNote = similarity != null ? ` (similarity ${similarity.toFixed(2)})` : "";
          throw new ConflictException(
            `Face verification did not succeed: ${outcome}${similarityNote} — check "manual override" to issue anyway`,
          );
        }
      }

      const [unpaidFine, openLoans, settings] = await Promise.all([
        tx.libraryFine.findFirst({ where: { organizationId, status: "PENDING", ...borrower } }),
        tx.libraryTransaction.count({ where: { organizationId, returnedAt: null, ...borrower } }),
        this.loadOrDefaultSettings(tx, organizationId),
      ]);
      if (unpaidFine) throw new ConflictException("This borrower has an unpaid library fine — settle it before issuing");
      if (openLoans >= settings.maxActiveLoans) {
        throw new ConflictException(`This borrower already has the maximum of ${settings.maxActiveLoans} active loan(s)`);
      }

      const issuedAt = new Date();
      const dueDate = new Date(issuedAt.getTime() + settings.loanPeriodDays * MS_PER_DAY);

      const transaction = await tx.libraryTransaction.create({
        data: { organizationId, bookId: dto.bookId, ...borrower, issuedAt, dueDate, issuedByUserId, issueFaceVerified },
        include: { book: true, student: true, employee: true },
      });
      await tx.book.update({ where: { id: dto.bookId }, data: { availableCopies: { decrement: 1 } } });

      // Opportunistically fulfill a matching READY reservation for this
      // same borrower+book, if one exists — mirrors librarysystem's own
      // issue()-side reservation fulfillment.
      const readyReservation = await tx.libraryReservation.findFirst({
        where: { organizationId, bookId: dto.bookId, status: "READY", ...borrower },
      });
      if (readyReservation) {
        await tx.libraryReservation.update({ where: { id: readyReservation.id }, data: { status: "FULFILLED" } });
      }

      // Feeds the dashboard's cross-module "Recent activity" feed —
      // metadata carries a human-readable title/borrower so that feed
      // doesn't have to reconstruct one from raw foreign keys.
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: issuedByUserId,
          action: "library_book.issued",
          resource: "library_transaction",
          resourceId: transaction.id,
          metadata: { bookTitle: transaction.book.title, borrowerName: borrowerDisplayName(transaction) },
        },
      });

      return transaction;
    });
  }

  async returnBook(organizationId: string, returnedByUserId: string, transactionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const transaction = await tx.libraryTransaction.findUnique({ where: { id: transactionId } });
      if (!transaction || transaction.organizationId !== organizationId) {
        throw new NotFoundException("Transaction not found");
      }
      if (transaction.returnedAt) throw new ConflictException("This book has already been returned");

      const returnedAt = new Date();
      const updated = await tx.libraryTransaction.update({
        where: { id: transactionId },
        data: { returnedAt, returnedByUserId },
        include: { book: true, student: true, employee: true },
      });
      await tx.book.update({ where: { id: transaction.bookId }, data: { availableCopies: { increment: 1 } } });

      const daysLate = Math.floor((returnedAt.getTime() - transaction.dueDate.getTime()) / MS_PER_DAY);
      let fine = null;
      if (daysLate > 0) {
        const settings = await this.loadOrDefaultSettings(tx, organizationId);
        const amount = daysLate * Number(settings.finePerDayRate);
        fine = await this.recordFine(tx, organizationId, {
          transactionId,
          studentId: transaction.studentId,
          employeeId: transaction.employeeId,
          reason: "LATE_RETURN",
          amount,
        });
      }

      // Fulfill the oldest pending reservation for this book, same
      // TC-07 behavior librarysystem's own Phase 3 verified.
      const nextReservation = await tx.libraryReservation.findFirst({
        where: { organizationId, bookId: transaction.bookId, status: "PENDING" },
        orderBy: { reservedAt: "asc" },
      });
      if (nextReservation) {
        await tx.libraryReservation.update({
          where: { id: nextReservation.id },
          data: { status: "READY", readyAt: new Date() },
        });
        const reserveeUserId = nextReservation.studentId
          ? (await tx.student.findUnique({ where: { id: nextReservation.studentId } }))?.userId
          : (await tx.employee.findUnique({ where: { id: nextReservation.employeeId! } }))?.userId;
        if (reserveeUserId) {
          await this.notifications.notify(organizationId, reserveeUserId, {
            type: "library_reservation_ready",
            title: "Your reserved book is ready",
            body: `"${updated.book.title}" is now available for you to collect.`,
            link: "/portal/library",
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: returnedByUserId,
          action: "library_book.returned",
          resource: "library_transaction",
          resourceId: updated.id,
          metadata: { bookTitle: updated.book.title, borrowerName: borrowerDisplayName(updated), daysLate },
        },
      });

      return { ...updated, fine };
    });
  }

  listTransactions(
    organizationId: string,
    filters: { bookId?: string; studentId?: string; employeeId?: string; open?: boolean },
  ) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryTransaction.findMany({
        where: {
          organizationId,
          bookId: filters.bookId,
          studentId: filters.studentId,
          employeeId: filters.employeeId,
          returnedAt: filters.open ? null : undefined,
        },
        include: { book: true, student: true, employee: true, fine: true },
        orderBy: { issuedAt: "desc" },
      }),
    );
  }

  // ── Fines ─────────────────────────────────────────────────────────

  async createFine(organizationId: string, dto: CreateFineDto) {
    if (!dto.studentId === !dto.employeeId) {
      throw new BadRequestException("Provide exactly one of studentId or employeeId");
    }
    return this.prisma.withTenant(organizationId, async (tx) => {
      const borrower = await this.resolveBorrower(tx, organizationId, dto);
      if (dto.transactionId) {
        const transaction = await tx.libraryTransaction.findUnique({ where: { id: dto.transactionId } });
        if (!transaction || transaction.organizationId !== organizationId) {
          throw new NotFoundException("Transaction not found");
        }
      }
      return this.recordFine(tx, organizationId, {
        transactionId: dto.transactionId,
        ...borrower,
        reason: dto.reason,
        amount: dto.amount,
      });
    });
  }

  listFines(organizationId: string, filters: { studentId?: string; employeeId?: string; status?: string }) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryFine.findMany({
        where: {
          organizationId,
          studentId: filters.studentId,
          employeeId: filters.employeeId,
          status: filters.status as never,
        },
        include: { student: true, employee: true, transaction: { include: { book: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async payFine(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const fine = await this.loadFine(tx, organizationId, id);
      if (fine.status !== "PENDING") throw new ConflictException("This fine is not pending payment");
      return tx.libraryFine.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    });
  }

  async waiveFine(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const fine = await this.loadFine(tx, organizationId, id);
      if (fine.status !== "PENDING") throw new ConflictException("This fine is not pending — nothing to waive");
      return tx.libraryFine.update({ where: { id }, data: { status: "WAIVED" } });
    });
  }

  // Shared by both the automatic LATE_RETURN path (returnBook) and the
  // manual staff-initiated path (createFine). Posts to Finance as a
  // real, standalone Invoice only when the borrower is a Student with
  // an ACTIVE enrollment — an Employee fine, or a student with none,
  // stays a plain record the librarian marks paid directly. This ERP
  // has no employee billing system at all, so that's the real ceiling
  // of what's postable, not a gap being papered over.
  private async recordFine(
    tx: PrismaClient,
    organizationId: string,
    data: {
      transactionId?: string;
      studentId: string | null;
      employeeId: string | null;
      reason: "LATE_RETURN" | "LOST" | "DAMAGED";
      amount: number;
    },
  ) {
    let invoiceId: string | undefined;
    if (data.studentId) {
      const enrollment = await tx.studentEnrollment.findFirst({
        where: { organizationId, studentId: data.studentId, status: "ACTIVE" },
      });
      if (enrollment) {
        const invoice = await this.postFineToInvoice(tx, organizationId, data.studentId, enrollment.id, data.amount);
        invoiceId = invoice.id;
      }
    }
    return tx.libraryFine.create({
      data: {
        organizationId,
        transactionId: data.transactionId,
        studentId: data.studentId,
        employeeId: data.employeeId,
        reason: data.reason,
        amount: data.amount,
        invoiceId,
      },
    });
  }

  // Same upsert-on-code precedent as HostelService.createLookup, and
  // the same collision-retry sequential-number shape as
  // FinanceService.nextInvoiceNumber/createInvoiceWithNumber — that
  // method is private and only reachable through the FeeStructure/
  // StudentFeeAssignment flow, which doesn't fit a one-off variable
  // amount, so this is a small, local, parallel implementation rather
  // than a cross-module call.
  private async postFineToInvoice(
    tx: PrismaClient,
    organizationId: string,
    studentId: string,
    studentEnrollmentId: string,
    amount: number,
  ) {
    const feeCategory = await tx.feeCategory.upsert({
      where: { organizationId_code: { organizationId, code: "LIBRARY_FINE" } },
      update: {},
      create: { organizationId, code: "LIBRARY_FINE", name: "Library Fine" },
    });

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const count = await tx.invoice.count({ where: { organizationId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;
      try {
        return await tx.invoice.create({
          data: {
            organizationId,
            invoiceNumber,
            studentId,
            studentEnrollmentId,
            totalAmount: amount,
            dueDate: new Date(),
            items: { create: [{ organizationId, feeCategoryId: feeCategory.id, amount, description: "Library fine" }] },
          },
        });
      } catch (err) {
        const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueViolation || attempt === maxAttempts) throw err;
      }
    }
    throw new Error("Could not generate a unique invoice number — please try again");
  }

  // ── Reservations ──────────────────────────────────────────────────

  async createReservation(organizationId: string, dto: CreateReservationDto) {
    if (!dto.studentId === !dto.employeeId) {
      throw new BadRequestException("Provide exactly one of studentId or employeeId");
    }
    return this.prisma.withTenant(organizationId, async (tx) => {
      const book = await this.loadBook(tx, organizationId, dto.bookId);
      if (book.availableCopies > 0) {
        throw new ConflictException("This book has available copies — borrow it directly instead of reserving");
      }
      const borrower = await this.resolveBorrower(tx, organizationId, dto);
      const existing = await tx.libraryReservation.findFirst({
        where: { organizationId, bookId: dto.bookId, status: { in: ["PENDING", "READY"] }, ...borrower },
      });
      if (existing) throw new ConflictException("This borrower already has an active reservation for this book");

      return tx.libraryReservation.create({
        data: { organizationId, bookId: dto.bookId, ...borrower },
        include: { book: true, student: true, employee: true },
      });
    });
  }

  listReservations(organizationId: string, filters: { bookId?: string; status?: string }) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryReservation.findMany({
        where: { organizationId, bookId: filters.bookId, status: filters.status as never },
        include: { book: true, student: true, employee: true },
        orderBy: { reservedAt: "desc" },
      }),
    );
  }

  async cancelReservation(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const reservation = await tx.libraryReservation.findUnique({ where: { id } });
      if (!reservation || reservation.organizationId !== organizationId) {
        throw new NotFoundException("Reservation not found");
      }
      if (reservation.status === "FULFILLED" || reservation.status === "CANCELLED") {
        throw new ConflictException("This reservation is already closed");
      }
      return tx.libraryReservation.update({ where: { id }, data: { status: "CANCELLED" } });
    });
  }

  // ── Settings ──────────────────────────────────────────────────────

  async getSettings(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const settings = await tx.librarySettings.findUnique({ where: { organizationId } });
      return settings ?? { organizationId, ...DEFAULT_SETTINGS };
    });
  }

  async updateSettings(organizationId: string, dto: UpdateLibrarySettingsDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.librarySettings.findUnique({ where: { organizationId } });
      return existing
        ? tx.librarySettings.update({ where: { organizationId }, data: dto })
        : tx.librarySettings.create({ data: { organizationId, ...DEFAULT_SETTINGS, ...dto } });
    });
  }

  private async loadOrDefaultSettings(tx: PrismaClient, organizationId: string) {
    const settings = await tx.librarySettings.findUnique({ where: { organizationId } });
    return settings ?? { organizationId, ...DEFAULT_SETTINGS };
  }

  // ── Reports ───────────────────────────────────────────────────────

  overdueReport(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryTransaction.findMany({
        where: { organizationId, returnedAt: null, dueDate: { lt: new Date() } },
        include: { book: true, student: true, employee: true },
        orderBy: { dueDate: "asc" },
      }),
    );
  }

  // groupBy's nested `orderBy: { _count: { bookId: "desc" } }` form —
  // not a plain field name — is a real gotcha librarysystem's own
  // Phase 4 hit and documented.
  async mostBorrowedReport(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const grouped = await tx.libraryTransaction.groupBy({
        by: ["bookId"],
        where: { organizationId },
        _count: { bookId: true },
        orderBy: { _count: { bookId: "desc" } },
        take: 20,
      });
      const books = await tx.book.findMany({ where: { id: { in: grouped.map((g) => g.bookId) } } });
      const bookMap = new Map(books.map((b) => [b.id, b]));
      return grouped.map((g) => ({ book: bookMap.get(g.bookId), borrowCount: g._count.bookId }));
    });
  }

  // ── FK-vs-RLS parent guards ──────────────────────────────────────

  private async loadCategory(tx: PrismaClient, organizationId: string, id: string) {
    const category = await tx.bookCategory.findUnique({ where: { id } });
    if (!category || category.organizationId !== organizationId) throw new NotFoundException("Book category not found");
    return category;
  }

  private async loadBook(tx: PrismaClient, organizationId: string, id: string) {
    const book = await tx.book.findUnique({ where: { id } });
    if (!book || book.organizationId !== organizationId) throw new NotFoundException("Book not found");
    return book;
  }

  private async loadFine(tx: PrismaClient, organizationId: string, id: string) {
    const fine = await tx.libraryFine.findUnique({ where: { id } });
    if (!fine || fine.organizationId !== organizationId) throw new NotFoundException("Fine not found");
    return fine;
  }

  private async resolveBorrower(
    tx: PrismaClient,
    organizationId: string,
    dto: { studentId?: string; employeeId?: string },
  ): Promise<{ studentId: string | null; employeeId: string | null }> {
    if (dto.studentId) {
      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
      return { studentId: dto.studentId, employeeId: null };
    }
    const employee = await tx.employee.findUnique({ where: { id: dto.employeeId! } });
    if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
    return { studentId: null, employeeId: dto.employeeId! };
  }

  // ── Face verification (reuses Phase 6's biometric infrastructure) ──

  // 1:1 "does this capture match the CLAIMED borrower's own
  // enrollment" — unlike camera-events' 1:N "identify anyone in the
  // org," the cosine-similarity query here is scoped to one specific
  // FaceEnrollment, not the whole org's face_embeddings table. Never
  // throws on a "couldn't verify" outcome — every branch returns an
  // outcome for the caller to decide on, same never-hard-block
  // precedent as every other branch of this method's own alt-flows.
  private async verifyBorrowerFace(
    tx: PrismaClient,
    organizationId: string,
    borrower: { studentId: string | null; employeeId: string | null },
    faceImageBase64: string,
  ): Promise<{ outcome: FaceVerifiedOutcome; similarity: number | null }> {
    const policy = await tx.biometricPolicy.findUnique({ where: { organizationId } });
    if (!policy?.enabled) return { outcome: "UNAVAILABLE", similarity: null };

    const enrollment = await tx.faceEnrollment.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        ...(borrower.studentId ? { studentId: borrower.studentId } : { staffId: borrower.employeeId }),
      },
      orderBy: { createdAt: "desc" },
      include: { faceEmbedding: true },
    });
    if (!enrollment?.faceEmbedding) return { outcome: "NOT_ENROLLED", similarity: null };

    let embedResult;
    try {
      const buffer = Buffer.from(faceImageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
      embedResult = await this.aiGateway.embedFaces(buffer, "capture.jpg", "image/jpeg");
    } catch {
      return { outcome: "UNAVAILABLE", similarity: null };
    }
    if (embedResult.faces.length === 0) return { outcome: "UNAVAILABLE", similarity: null };

    const bestFace = embedResult.faces.reduce((best, f) => (f.detScore > best.detScore ? f : best));
    const embeddingLiteral = `[${bestFace.embedding.join(",")}]`;
    const rows = await tx.$queryRawUnsafe<{ similarity: number }[]>(
      `SELECT 1 - (fe."embedding" <=> $1::vector) AS similarity
       FROM "face_embeddings" fe
       WHERE fe."faceEnrollmentId" = $2`,
      embeddingLiteral,
      enrollment.id,
    );
    const similarity = rows[0]?.similarity ?? 0;
    return { outcome: similarity >= policy.matchConfidenceThreshold ? "MATCHED" : "NOT_MATCHED", similarity };
  }
}
