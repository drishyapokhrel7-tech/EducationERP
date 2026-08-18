import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { CreateGuardianDto } from "./dto/create-guardian.dto";
import { AttachGuardianDto } from "./dto/attach-guardian.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateStudentStatusDto } from "./dto/update-student-status.dto";

/** Same load-bearing parent-guard pattern as every prior slice's service. */
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  listStudents(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.student.findMany({
        where: { organizationId, deletedAt: null },
        include: { guardians: { include: { guardian: true } } },
      }),
    );
  }

  createStudent(organizationId: string, dto: CreateStudentDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.student.create({
        data: {
          organizationId,
          studentCode: dto.studentCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
        },
      }),
    );
  }

  listGuardians(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.findMany({ where: { organizationId } }),
    );
  }

  createGuardian(organizationId: string, dto: CreateGuardianDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.guardian.create({
        data: {
          organizationId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          occupation: dto.occupation,
        },
      }),
    );
  }

  private async requireStudent(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException("Student not found");
      return student;
    });
  }

  async attachGuardian(organizationId: string, studentId: string, dto: AttachGuardianDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guardian = await tx.guardian.findUnique({ where: { id: dto.guardianId } });
      if (!guardian) throw new NotFoundException("Guardian not found");

      return tx.studentGuardian.create({
        data: {
          organizationId,
          studentId,
          guardianId: dto.guardianId,
          relationship: dto.relationship,
          isPrimaryContact: dto.isPrimaryContact ?? false,
        },
      });
    });
  }

  async listEnrollments(organizationId: string, studentId: string) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentEnrollment.findMany({
        where: { organizationId, studentId },
        include: { program: true, section: true, term: true },
      }),
    );
  }

  async createEnrollment(organizationId: string, studentId: string, dto: CreateEnrollmentDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const [program, section, term] = await Promise.all([
        tx.program.findUnique({ where: { id: dto.programId } }),
        tx.section.findUnique({ where: { id: dto.sectionId } }),
        tx.term.findUnique({ where: { id: dto.termId } }),
      ]);
      if (!program) throw new NotFoundException("Program not found");
      if (!section) throw new NotFoundException("Section not found");
      if (!term) throw new NotFoundException("Term not found");

      return tx.studentEnrollment.create({
        data: {
          organizationId,
          studentId,
          programId: dto.programId,
          sectionId: dto.sectionId,
          termId: dto.termId,
          enrollmentDate: new Date(dto.enrollmentDate),
        },
      });
    });
  }

  async listStatusHistory(organizationId: string, studentId: string) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.studentStatusHistory.findMany({ where: { organizationId, studentId } }),
    );
  }

  async updateStatus(organizationId: string, studentId: string, dto: UpdateStudentStatusDto) {
    await this.requireStudent(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      // Sequential, not Promise.all: both are writes sharing the same
      // interactive-transaction connection, and this update+history pair
      // needs to commit or roll back together, not race each other.
      await tx.student.update({ where: { id: studentId }, data: { status: dto.status } });
      return tx.studentStatusHistory.create({
        data: {
          organizationId,
          studentId,
          status: dto.status,
          reason: dto.reason,
          effectiveDate: new Date(dto.effectiveDate),
        },
      });
    });
  }
}
