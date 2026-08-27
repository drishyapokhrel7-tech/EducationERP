import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAlumniProfileDto } from "./dto/create-alumni-profile.dto";
import { UpdateAlumniProfileDto } from "./dto/update-alumni-profile.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { CreateEducationDto } from "./dto/create-education.dto";
import { CreateCareerHistoryDto } from "./dto/create-career-history.dto";
import { UpdateCareerHistoryDto } from "./dto/update-career-history.dto";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { CreateCertificationDto } from "./dto/create-certification.dto";

const PROFILE_INCLUDE = {
  student: true,
  education: { orderBy: { startYear: "desc" as const } },
  careerHistory: { include: { company: true }, orderBy: { startDate: "desc" as const } },
  skills: true,
  certifications: true,
};

@Injectable()
export class AlumniService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Profiles ──────────────────────────────────────────────────────

  async createProfile(organizationId: string, dto: CreateAlumniProfileDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const student = await tx.student.findUnique({ where: { id: dto.studentId } });
      if (!student || student.organizationId !== organizationId) throw new NotFoundException("Student not found");
      if (student.status !== "GRADUATED") {
        throw new BadRequestException("Only a student marked GRADUATED can get an alumni profile");
      }
      const existing = await tx.alumniProfile.findUnique({ where: { studentId: dto.studentId } });
      if (existing) throw new ConflictException("This student already has an alumni profile");

      return tx.alumniProfile.create({
        data: {
          organizationId,
          studentId: dto.studentId,
          graduationYear: dto.graduationYear,
          currentOccupation: dto.currentOccupation,
          currentEmployer: dto.currentEmployer,
          currentLocation: dto.currentLocation,
          bio: dto.bio,
          linkedinUrl: dto.linkedinUrl,
        },
        include: PROFILE_INCLUDE,
      });
    });
  }

  listProfiles(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniProfile.findMany({ where: { organizationId }, include: PROFILE_INCLUDE, orderBy: { graduationYear: "desc" } }),
    );
  }

  async getProfile(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const profile = await tx.alumniProfile.findUnique({ where: { id }, include: PROFILE_INCLUDE });
      if (!profile || profile.organizationId !== organizationId) throw new NotFoundException("Alumni profile not found");
      return profile;
    });
  }

  async updateProfile(organizationId: string, id: string, dto: UpdateAlumniProfileDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, id);
      return tx.alumniProfile.update({ where: { id }, data: dto, include: PROFILE_INCLUDE });
    });
  }

  // ── Companies ─────────────────────────────────────────────────────

  createCompany(organizationId: string, dto: CreateCompanyDto) {
    // Upsert-by-name — same reasoning as HostelLookup: two people
    // adding the same new company before either sees the other's
    // addition should resolve to one row, not a 409 or a duplicate.
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniCompany.upsert({
        where: { organizationId_name: { organizationId, name: dto.name } },
        update: {},
        create: { organizationId, name: dto.name, industry: dto.industry, website: dto.website },
      }),
    );
  }

  listCompanies(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniCompany.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  // ── Education ─────────────────────────────────────────────────────

  async addEducation(organizationId: string, profileId: string, dto: CreateEducationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      return tx.alumniEducation.create({ data: { organizationId, alumniProfileId: profileId, ...dto } });
    });
  }

  async removeEducation(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniEducation.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Education record not found");
      return tx.alumniEducation.delete({ where: { id } });
    });
  }

  // ── Career history ────────────────────────────────────────────────

  async addCareerHistory(organizationId: string, profileId: string, dto: CreateCareerHistoryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      const company = await tx.alumniCompany.findUnique({ where: { id: dto.companyId } });
      if (!company || company.organizationId !== organizationId) throw new NotFoundException("Company not found");
      return tx.alumniCareerHistory.create({
        data: {
          organizationId,
          alumniProfileId: profileId,
          companyId: dto.companyId,
          jobTitle: dto.jobTitle,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          description: dto.description,
        },
        include: { company: true },
      });
    });
  }

  async updateCareerHistory(organizationId: string, id: string, dto: UpdateCareerHistoryDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniCareerHistory.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Career history record not found");
      return tx.alumniCareerHistory.update({ where: { id }, data: { endDate: new Date(dto.endDate) }, include: { company: true } });
    });
  }

  async removeCareerHistory(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniCareerHistory.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Career history record not found");
      return tx.alumniCareerHistory.delete({ where: { id } });
    });
  }

  // ── Skills ────────────────────────────────────────────────────────

  async addSkill(organizationId: string, profileId: string, dto: CreateSkillDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      return tx.alumniSkill.create({ data: { organizationId, alumniProfileId: profileId, skillName: dto.skillName } });
    });
  }

  async removeSkill(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniSkill.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Skill not found");
      return tx.alumniSkill.delete({ where: { id } });
    });
  }

  // ── Certifications ────────────────────────────────────────────────

  async addCertification(organizationId: string, profileId: string, dto: CreateCertificationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      return tx.alumniCertification.create({
        data: {
          organizationId,
          alumniProfileId: profileId,
          name: dto.name,
          issuingOrganization: dto.issuingOrganization,
          issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : undefined,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          credentialUrl: dto.credentialUrl,
        },
      });
    });
  }

  async removeCertification(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniCertification.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Certification not found");
      return tx.alumniCertification.delete({ where: { id } });
    });
  }

  // ── Self-service (reused by StudentPortalService — an alumnus keeps
  // using their existing student-portal login) ─────────────────────

  async getOwnProfile(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const profile = await tx.alumniProfile.findUnique({ where: { studentId }, include: PROFILE_INCLUDE });
      if (!profile) throw new NotFoundException("No alumni profile exists for this account yet");
      return profile;
    });
  }

  async updateOwnProfile(organizationId: string, studentId: string, dto: UpdateAlumniProfileDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.updateProfile(organizationId, profile.id, dto);
  }

  async addOwnEducation(organizationId: string, studentId: string, dto: CreateEducationDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.addEducation(organizationId, profile.id, dto);
  }

  async addOwnCareerHistory(organizationId: string, studentId: string, dto: CreateCareerHistoryDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.addCareerHistory(organizationId, profile.id, dto);
  }

  async addOwnSkill(organizationId: string, studentId: string, dto: CreateSkillDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.addSkill(organizationId, profile.id, dto);
  }

  async addOwnCertification(organizationId: string, studentId: string, dto: CreateCertificationDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.addCertification(organizationId, profile.id, dto);
  }

  // ── FK-vs-RLS parent guard ───────────────────────────────────────

  private async loadProfile(tx: PrismaClient, organizationId: string, id: string) {
    const profile = await tx.alumniProfile.findUnique({ where: { id } });
    if (!profile || profile.organizationId !== organizationId) throw new NotFoundException("Alumni profile not found");
    return profile;
  }
}
