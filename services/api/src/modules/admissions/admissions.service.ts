import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StudentsService } from "../students/students.service";
import { CreateAdmissionApplicationDto } from "./dto/create-admission-application.dto";
import { UpdateAdmissionStatusDto } from "./dto/update-admission-status.dto";
import { EnrollApplicationDto } from "./dto/enroll-application.dto";

/** Same load-bearing parent-guard pattern as every prior slice's service. */
@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  listApplications(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.admissionApplication.findMany({
        where: { organizationId },
        include: { program: true },
      }),
    );
  }

  async createApplication(organizationId: string, dto: CreateAdmissionApplicationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const program = await tx.program.findUnique({ where: { id: dto.programId } });
      if (!program) throw new NotFoundException("Program not found");

      return tx.admissionApplication.create({
        data: {
          organizationId,
          programId: dto.programId,
          applicantFirstName: dto.applicantFirstName,
          applicantLastName: dto.applicantLastName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          appliedDate: new Date(dto.appliedDate),
          score: dto.score,
          notes: dto.notes,
        },
      });
    });
  }

  private async requireApplication(organizationId: string, applicationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const application = await tx.admissionApplication.findUnique({ where: { id: applicationId } });
      if (!application) throw new NotFoundException("Admission application not found");
      return application;
    });
  }

  async listStatusHistory(organizationId: string, applicationId: string) {
    await this.requireApplication(organizationId, applicationId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.admissionStatusHistory.findMany({ where: { organizationId, applicationId } }),
    );
  }

  async updateStatus(organizationId: string, applicationId: string, dto: UpdateAdmissionStatusDto) {
    await this.requireApplication(organizationId, applicationId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await tx.admissionApplication.update({
        where: { id: applicationId },
        data: { status: dto.status },
      });
      return tx.admissionStatusHistory.create({
        data: {
          organizationId,
          applicationId,
          status: dto.status,
          reason: dto.reason,
          effectiveDate: new Date(dto.effectiveDate),
        },
      });
    });
  }

  async enroll(organizationId: string, applicationId: string, dto: EnrollApplicationDto) {
    const application = await this.requireApplication(organizationId, applicationId);
    if (application.status !== "APPROVED") {
      throw new BadRequestException("Only an APPROVED application can be enrolled");
    }
    if (application.enrolledStudentId) {
      throw new BadRequestException("This application has already been enrolled");
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      const [section, term] = await Promise.all([
        tx.section.findUnique({ where: { id: dto.sectionId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!section) throw new NotFoundException("Section not found");
      if (!term) throw new NotFoundException("Term not found");

      // Same generated-code rule and collision-retry as the direct
      // Students-page create path (StudentsService.createStudent) —
      // one rule for how a student gets a code, not a hand-typed one
      // here that could eventually collide with the auto-sequence.
      const student = await (async () => {
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const studentCode = await this.students.nextStudentCode(tx, organizationId);
          try {
            return await tx.student.create({
              data: {
                organizationId,
                studentCode,
                firstName: application.applicantFirstName,
                lastName: application.applicantLastName,
                dateOfBirth: application.dateOfBirth,
                gender: application.gender,
              },
            });
          } catch (err) {
            const isUniqueViolation = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
            if (!isUniqueViolation || attempt === maxAttempts) throw err;
          }
        }
        throw new Error("Could not generate a unique student code — please try again");
      })();

      if (application.guardianName) {
        const { firstName, lastName } = splitName(application.guardianName);
        const guardian = await tx.guardian.create({
          data: {
            organizationId,
            firstName,
            lastName,
            phone: application.guardianPhone ?? "Unknown",
          },
        });
        await tx.studentGuardian.create({
          data: {
            organizationId,
            studentId: student.id,
            guardianId: guardian.id,
            relationship: "Guardian",
            isPrimaryContact: true,
          },
        });
      }

      await tx.studentEnrollment.create({
        data: {
          organizationId,
          studentId: student.id,
          programId: application.programId,
          sectionId: dto.sectionId,
          termId: dto.termId,
          enrollmentDate: new Date(dto.enrollmentDate),
        },
      });

      await tx.admissionApplication.update({
        where: { id: applicationId },
        data: { status: "ENROLLED", enrolledStudentId: student.id },
      });
      await tx.admissionStatusHistory.create({
        data: {
          organizationId,
          applicationId,
          status: "ENROLLED",
          reason: "Enrolled",
          effectiveDate: new Date(dto.enrollmentDate),
        },
      });

      return student;
    });
  }
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return { firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1) };
}
