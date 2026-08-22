import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateBiometricPolicyDto } from "./dto/update-biometric-policy.dto";
import { CreateFaceEnrollmentDto } from "./dto/create-face-enrollment.dto";

const DEFAULT_POLICY = { enabled: false, retentionDays: 365, matchConfidenceThreshold: 0.75 };

/**
 * Privacy/consent foundation for Phase 6 (CCTV/Biometric) — slice 6a.
 * No face image, embedding, camera, or matching logic exists yet; this
 * only gates and records *whether biometric capture is allowed at all*
 * for a given org, and *who specifically consented*, before any of that
 * capability is built in later slices.
 */
@Injectable()
export class BiometricPolicyService {
  constructor(private readonly prisma: PrismaService) {}

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
        include: { student: true, staff: true },
        orderBy: { createdAt: "desc" },
      }),
    );
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
