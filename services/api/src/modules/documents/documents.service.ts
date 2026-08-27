import { randomBytes } from "crypto";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDocumentDto } from "./dto/create-student-document.dto";
import { CreateStaffDocumentDto } from "./dto/create-staff-document.dto";
import { ReviewDocumentDto } from "./dto/review-document.dto";
import { CreateCertificateDto } from "./dto/create-certificate.dto";
import { RevokeCertificateDto } from "./dto/revoke-certificate.dto";

// Public, minimal shape returned by the unauthenticated verification
// endpoint — deliberately excludes organizationId, issuedByUserId, the
// certificate's own id, and fileUrl (a stranger with just the
// verification code should be able to confirm "yes, this is real,"
// not download the document itself or learn anything about the
// issuing org's internals).
export interface PublicCertificateVerification {
  studentName: string;
  type: string;
  issuedAt: Date;
  status: string;
  revokedAt: Date | null;
}

function generateVerificationCode() {
  // 10 base32-ish characters (uppercase alphanumeric, no ambiguous
  // 0/O/1/I) — short enough to type/read off a printed certificate,
  // long enough that guessing one isn't practical.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(10))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Student documents (RLS-protected, normal tenant scoping) ────────

  async createStudentDocument(organizationId: string, dto: CreateStudentDocumentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadStudent(tx, organizationId, dto.studentId);
      return tx.studentDocument.create({
        data: { organizationId, studentId: dto.studentId, documentType: dto.documentType, fileUrl: dto.fileUrl },
      });
    });
  }

  listStudentDocuments(organizationId: string, studentId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentDocument.findMany({
        where: { organizationId, studentId },
        include: { student: true },
        orderBy: { uploadedAt: "desc" },
      }),
    );
  }

  async reviewStudentDocument(organizationId: string, userId: string, documentId: string, dto: ReviewDocumentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const doc = await tx.studentDocument.findUnique({ where: { id: documentId } });
      if (!doc || doc.organizationId !== organizationId) throw new NotFoundException("Document not found");
      return tx.studentDocument.update({
        where: { id: documentId },
        data: { status: dto.status, reviewNotes: dto.reviewNotes, reviewedByUserId: userId, reviewedAt: new Date() },
      });
    });
  }

  // ── Staff documents (RLS-protected, normal tenant scoping) ──────────

  async createStaffDocument(organizationId: string, dto: CreateStaffDocumentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee || employee.organizationId !== organizationId) throw new NotFoundException("Employee not found");
      return tx.staffDocument.create({
        data: { organizationId, employeeId: dto.employeeId, documentType: dto.documentType, fileUrl: dto.fileUrl },
      });
    });
  }

  listStaffDocuments(organizationId: string, employeeId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.staffDocument.findMany({
        where: { organizationId, employeeId },
        include: { employee: true },
        orderBy: { uploadedAt: "desc" },
      }),
    );
  }

  async reviewStaffDocument(organizationId: string, userId: string, documentId: string, dto: ReviewDocumentDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const doc = await tx.staffDocument.findUnique({ where: { id: documentId } });
      if (!doc || doc.organizationId !== organizationId) throw new NotFoundException("Document not found");
      return tx.staffDocument.update({
        where: { id: documentId },
        data: { status: dto.status, reviewNotes: dto.reviewNotes, reviewedByUserId: userId, reviewedAt: new Date() },
      });
    });
  }

  // ── Self-service (student portal) ────────────────────────────────────

  async uploadOwnDocument(organizationId: string, studentId: string, dto: { documentType: string; fileUrl: string }) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentDocument.create({
        data: { organizationId, studentId, documentType: dto.documentType, fileUrl: dto.fileUrl },
      }),
    );
  }

  listOwnDocuments(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentDocument.findMany({ where: { organizationId, studentId }, orderBy: { uploadedAt: "desc" } }),
    );
  }

  listOwnCertificates(organizationId: string, studentId: string) {
    // certificates has no RLS (see schema.prisma) — organizationId AND
    // studentId are both explicit here, same discipline AuthService
    // already applies to every direct User query.
    return this.prisma.certificate.findMany({ where: { organizationId, studentId }, orderBy: { issuedAt: "desc" } });
  }

  // ── Certificates (org-scoped in application code — the certificates
  // table itself has no RLS, see schema.prisma for why. But the
  // Student it joins to DOES have RLS, so any query that touches
  // student — a create's parent-guard lookup, or a list's `include` —
  // still has to run inside withTenant for that join to see anything
  // at all; only a query that touches certificates alone can skip it.
  // Getting this distinction wrong is exactly the bug the e2e test
  // for this slice caught: createCertificate 404'd on a real student
  // because its parent-guard lookup ran outside withTenant against an
  // RLS-protected table with no GUC set — no GUC means no rows,
  // full stop, the same failure mode already documented for the
  // public verify path itself.) ─────────────────────────────────────

  async createCertificate(organizationId: string, userId: string, dto: CreateCertificateDto) {
    const student = await this.prisma.withTenant(organizationId, (tx) => tx.student.findUnique({ where: { id: dto.studentId } }));
    if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");

    // Collision odds on a 10-char, 33-symbol alphabet are astronomically
    // low, but the column is @unique regardless — retry once on the
    // off chance rather than trusting probability alone.
    for (let attempt = 0; attempt < 5; attempt++) {
      const verificationCode = generateVerificationCode();
      try {
        return await this.prisma.certificate.create({
          data: {
            organizationId,
            studentId: dto.studentId,
            type: dto.type,
            fileUrl: dto.fileUrl,
            issuedByUserId: userId,
            verificationCode,
          },
        });
      } catch (err) {
        const isUniqueViolation = typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
        if (!isUniqueViolation || attempt === 4) throw err;
      }
    }
    throw new ConflictException("Could not generate a unique verification code — try again");
  }

  listCertificates(organizationId: string, studentId?: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.certificate.findMany({
        where: { organizationId, studentId },
        include: { student: true },
        orderBy: { issuedAt: "desc" },
      }),
    );
  }

  async revokeCertificate(organizationId: string, certificateId: string, dto: RevokeCertificateDto) {
    // No join to student here — a direct query is fine, same as
    // AuthService's direct User queries.
    const certificate = await this.prisma.certificate.findUnique({ where: { id: certificateId } });
    if (!certificate || certificate.organizationId !== organizationId) throw new NotFoundException("Certificate not found");
    if (certificate.status === "REVOKED") throw new ConflictException("This certificate is already revoked");
    return this.prisma.certificate.update({
      where: { id: certificateId },
      data: { status: "REVOKED", revokedAt: new Date(), revokedReason: dto.reason },
    });
  }

  // ── Public verification (no auth, no tenant context — see
  // schema.prisma's Certificate comment). Genuinely two-step: the
  // certificate row itself is findable with no tenant context (no
  // RLS on that table), but its organizationId isn't known until
  // after that first read, and the student it belongs to DOES have
  // RLS — so the join has to happen in a second, now-tenant-scoped
  // step using the organizationId the first step just revealed.
  // ─────────────────────────────────────────────────────────────────

  async verifyCertificate(verificationCode: string): Promise<PublicCertificateVerification> {
    const certificate = await this.prisma.certificate.findUnique({ where: { verificationCode } });
    if (!certificate) throw new NotFoundException("No certificate found for this verification code");
    const student = await this.prisma.withTenant(certificate.organizationId, (tx) =>
      tx.student.findUnique({ where: { id: certificate.studentId } }),
    );
    return {
      studentName: student ? `${student.firstName} ${student.lastName}` : "(unknown)",
      type: certificate.type,
      issuedAt: certificate.issuedAt,
      status: certificate.status,
      revokedAt: certificate.revokedAt,
    };
  }

  // ── FK-vs-RLS parent guard ───────────────────────────────────────────

  private async loadStudent(tx: PrismaClient, organizationId: string, id: string) {
    const student = await tx.student.findUnique({ where: { id } });
    if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
    return student;
  }
}
