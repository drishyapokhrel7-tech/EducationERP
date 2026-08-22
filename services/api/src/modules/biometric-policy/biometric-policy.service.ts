import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { UpdateBiometricPolicyDto } from "./dto/update-biometric-policy.dto";
import { CreateFaceEnrollmentDto } from "./dto/create-face-enrollment.dto";

const DEFAULT_POLICY = { enabled: false, retentionDays: 365, matchConfidenceThreshold: 0.75 };

// A photo meant for enrollment should be one clear headshot — this is
// exactly the "what counts as a good photo" policy slice 6b's service
// deliberately left to its caller.
const MIN_ENROLLMENT_FACE_CONFIDENCE = 0.5;

/**
 * Privacy/consent foundation for Phase 6 (CCTV/Biometric) — slice 6a.
 * No face image, embedding, camera, or matching logic exists yet; this
 * only gates and records *whether biometric capture is allowed at all*
 * for a given org, and *who specifically consented*, before any of that
 * capability is built in later slices.
 */
@Injectable()
export class BiometricPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  // No row means "disabled" — the fail-safe default, so an org never
  // has to take an explicit action to end up in the safe state. GET
  // never creates a row; only an explicit PUT does.
  async getPolicy(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const policy = await tx.biometricPolicy.findUnique({ where: { organizationId } });
      return policy ?? { organizationId, ...DEFAULT_POLICY };
    });
  }

  async updatePolicy(organizationId: string, userId: string, dto: UpdateBiometricPolicyDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const existing = await tx.biometricPolicy.findUnique({ where: { organizationId } });
      const policy = existing
        ? await tx.biometricPolicy.update({ where: { organizationId }, data: dto })
        : await tx.biometricPolicy.create({ data: { organizationId, ...DEFAULT_POLICY, ...dto } });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "biometric_policy.updated",
          resource: "biometric_policy",
          resourceId: policy.id,
          metadata: { ...dto },
        },
      });
      return policy;
    });
  }

  async createEnrollment(organizationId: string, userId: string, dto: CreateFaceEnrollmentDto) {
    if (!dto.studentId === !dto.staffId) {
      // Both true (neither given, since !undefined === !undefined) or
      // both false (both given) — exactly one must be set.
      throw new BadRequestException("Provide exactly one of studentId or staffId");
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      const policy = await tx.biometricPolicy.findUnique({ where: { organizationId } });
      if (!policy?.enabled) {
        throw new BadRequestException("Biometric enrollment is disabled for this organization");
      }

      if (dto.studentId) {
        const student = await tx.student.findUnique({ where: { id: dto.studentId } });
        if (!student) throw new NotFoundException("Student not found");
      } else {
        const staff = await tx.employee.findUnique({ where: { id: dto.staffId } });
        if (!staff) throw new NotFoundException("Staff member not found");
      }

      const enrollment = await tx.faceEnrollment.create({
        data: {
          organizationId,
          studentId: dto.studentId,
          staffId: dto.staffId,
          consentGivenBy: dto.consentGivenBy,
          consentGivenAt: dto.consentGivenAt ? new Date(dto.consentGivenAt) : new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "face_enrollment.created",
          resource: "biometric_enrollment",
          resourceId: enrollment.id,
          metadata: { studentId: dto.studentId, staffId: dto.staffId, consentGivenBy: dto.consentGivenBy },
        },
      });
      return enrollment;
    });
  }

  listEnrollments(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.faceEnrollment.findMany({
        where: { organizationId },
        // faceEmbedding's `embedding` column is Unsupported() in the
        // Prisma schema — the generated client has no way to select or
        // return it at all, so including the relation here is safe:
        // it can only ever surface id/modelVersion/createdAt, never
        // the raw vector.
        include: { student: true, staff: true, faceEmbedding: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async addEnrollmentPhoto(
    organizationId: string,
    userId: string,
    enrollmentId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.faceEnrollment.findUnique({ where: { id: enrollmentId } });
      if (!enrollment) throw new NotFoundException("Enrollment not found");
      if (enrollment.status === "WITHDRAWN") {
        throw new BadRequestException("Cannot add a photo to a withdrawn enrollment");
      }

      const result = await this.aiGateway.embedFaces(file.buffer, file.originalname, file.mimetype);
      if (result.faces.length === 0) {
        throw new BadRequestException("No face detected in the photo");
      }
      if (result.faces.length > 1) {
        throw new BadRequestException("Photo must contain exactly one face");
      }
      const face = result.faces[0];
      if (face.detScore < MIN_ENROLLMENT_FACE_CONFIDENCE) {
        throw new BadRequestException("Face is not clear enough — try a photo with better lighting/focus");
      }

      // Unsupported() columns can't be written through the normal
      // Prisma Client API — raw SQL, with an explicit ::vector cast, is
      // the only way to set this column (verified directly against
      // this project's real Neon database before this slice was
      // planned). ON CONFLICT replaces a prior embedding for the same
      // enrollment (a re-uploaded, better photo supersedes the old one)
      // rather than erroring on the unique faceEnrollmentId.
      const embeddingLiteral = `[${face.embedding.join(",")}]`;
      const id = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO "face_embeddings" ("id", "organizationId", "faceEnrollmentId", "embedding", "modelVersion", "createdAt")
         VALUES ($1, $2, $3, $4::vector, $5, now())
         ON CONFLICT ("faceEnrollmentId") DO UPDATE SET "embedding" = EXCLUDED."embedding", "modelVersion" = EXCLUDED."modelVersion"`,
        id,
        organizationId,
        enrollmentId,
        embeddingLiteral,
        result.modelName,
      );

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "face_enrollment.photo_added",
          resource: "biometric_enrollment",
          resourceId: enrollmentId,
          metadata: { detScore: face.detScore, modelName: result.modelName },
        },
      });

      return { enrollmentId, detScore: face.detScore, modelName: result.modelName };
    });
  }

  async withdrawEnrollment(organizationId: string, userId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const enrollment = await tx.faceEnrollment.findUnique({ where: { id } });
      if (!enrollment) throw new NotFoundException("Enrollment not found");
      if (enrollment.status === "WITHDRAWN") {
        throw new ConflictException("Consent has already been withdrawn");
      }

      const updated = await tx.faceEnrollment.update({
        where: { id },
        data: { status: "WITHDRAWN", consentWithdrawnAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "face_enrollment.withdrawn",
          resource: "biometric_enrollment",
          resourceId: id,
        },
      });
      return updated;
    });
  }
}
