import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMyReservationDto } from "./dto/create-my-reservation.dto";

/**
 * Self-service, not admin-facing — studentId is derived exclusively
 * from the authenticated user's linked Student row, never from a
 * request param, same idiom as StudentPortalService/
 * GuardianPortalService. Scoped to Student only for v1 — a staff
 * member without the Librarian role has no self-service "my own loans"
 * view yet (stated limitation, not a silent gap).
 */
@Injectable()
export class LibraryPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(organizationId: string, userId: string) {
    return this.getOwnStudent(organizationId, userId);
  }

  searchBooks(organizationId: string, query?: string) {
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

  async listMyLoans(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryTransaction.findMany({
        where: { organizationId, studentId: student.id },
        include: { book: true, fine: true },
        orderBy: { issuedAt: "desc" },
      }),
    );
  }

  async listMyFines(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryFine.findMany({
        where: { organizationId, studentId: student.id },
        include: { transaction: { include: { book: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async listMyReservations(organizationId: string, userId: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.libraryReservation.findMany({
        where: { organizationId, studentId: student.id },
        include: { book: true },
        orderBy: { reservedAt: "desc" },
      }),
    );
  }

  async createReservation(organizationId: string, userId: string, dto: CreateMyReservationDto) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const book = await tx.book.findUnique({ where: { id: dto.bookId } });
      if (!book || book.organizationId !== organizationId) throw new NotFoundException("Book not found");
      if (book.availableCopies > 0) {
        throw new ConflictException("This book has available copies — no need to reserve it");
      }
      const existing = await tx.libraryReservation.findFirst({
        where: { organizationId, bookId: dto.bookId, studentId: student.id, status: { in: ["PENDING", "READY"] } },
      });
      if (existing) throw new ConflictException("You already have an active reservation for this book");

      return tx.libraryReservation.create({
        data: { organizationId, bookId: dto.bookId, studentId: student.id },
        include: { book: true },
      });
    });
  }

  async cancelReservation(organizationId: string, userId: string, id: string) {
    const student = await this.getOwnStudent(organizationId, userId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const reservation = await tx.libraryReservation.findUnique({ where: { id } });
      // 404, never 403, on another student's reservation id — same
      // "don't confirm existence" precedent as every other self-service
      // module's ownership check.
      if (!reservation || reservation.organizationId !== organizationId || reservation.studentId !== student.id) {
        throw new NotFoundException("Reservation not found");
      }
      if (reservation.status === "FULFILLED" || reservation.status === "CANCELLED") {
        throw new ConflictException("This reservation is already closed");
      }
      return tx.libraryReservation.update({ where: { id }, data: { status: "CANCELLED" } });
    });
  }

  private async getOwnStudent(organizationId: string, userId: string) {
    const student = await this.prisma.withTenant(organizationId, (tx) => tx.student.findUnique({ where: { userId } }));
    if (!student) throw new NotFoundException("No student record is linked to this account");
    return student;
  }
}
