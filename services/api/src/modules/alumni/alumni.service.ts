import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAlumniProfileDto } from "./dto/create-alumni-profile.dto";
import { UpdateAlumniProfileDto } from "./dto/update-alumni-profile.dto";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { CreateEducationDto } from "./dto/create-education.dto";
import { CreateCareerHistoryDto } from "./dto/create-career-history.dto";
import { UpdateCareerHistoryDto } from "./dto/update-career-history.dto";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { CreateCertificationDto } from "./dto/create-certification.dto";
import { CreateSurveyDto } from "./dto/create-survey.dto";
import { UpdateSurveyDto } from "./dto/update-survey.dto";
import { SubmitSurveyResponseDto } from "./dto/submit-survey-response.dto";
import { CreateMentorshipDto } from "./dto/create-mentorship.dto";
import { RespondMentorshipDto } from "./dto/respond-mentorship.dto";
import { CreateAchievementDto } from "./dto/create-achievement.dto";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { ReviewOpportunityDto } from "./dto/review-opportunity.dto";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { CreateCareerServiceDto } from "./dto/create-career-service.dto";
import { UpdateCareerServiceDto } from "./dto/update-career-service.dto";
import { SetGraduateOutcomeDto } from "./dto/set-graduate-outcome.dto";

const PROFILE_INCLUDE = {
  student: true,
  education: { orderBy: { startYear: "desc" as const } },
  careerHistory: { include: { company: true }, orderBy: { startDate: "desc" as const } },
  skills: true,
  certifications: true,
  achievements: { orderBy: { createdAt: "desc" as const } },
  graduateOutcome: true,
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

  // ── Surveys (Phase 8 slice 8b) ───────────────────────────────────

  createSurvey(organizationId: string, dto: CreateSurveyDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniSurvey.create({
        data: {
          organizationId,
          title: dto.title,
          description: dto.description,
          questions: dto.questions as unknown as Prisma.InputJsonValue,
        },
      }),
    );
  }

  listSurveys(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniSurvey.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    );
  }

  // Self-service list only ever shows PUBLISHED/CLOSED surveys — a
  // DRAFT survey's question set isn't finalized yet and shouldn't be
  // visible to alumni before an admin publishes it.
  listPublishedSurveys(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniSurvey.findMany({
        where: { organizationId, status: { in: ["PUBLISHED", "CLOSED"] } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async updateSurvey(organizationId: string, id: string, dto: UpdateSurveyDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const survey = await this.loadSurvey(tx, organizationId, id);
      if (survey.status !== "DRAFT") throw new BadRequestException("Only a DRAFT survey can be edited");
      return tx.alumniSurvey.update({
        where: { id },
        data: { ...dto, questions: dto.questions ? (dto.questions as unknown as Prisma.InputJsonValue) : undefined },
      });
    });
  }

  async publishSurvey(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const survey = await this.loadSurvey(tx, organizationId, id);
      if (survey.status !== "DRAFT") throw new ConflictException("Only a DRAFT survey can be published");
      return tx.alumniSurvey.update({ where: { id }, data: { status: "PUBLISHED" } });
    });
  }

  async closeSurvey(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const survey = await this.loadSurvey(tx, organizationId, id);
      if (survey.status !== "PUBLISHED") throw new ConflictException("Only a PUBLISHED survey can be closed");
      return tx.alumniSurvey.update({ where: { id }, data: { status: "CLOSED" } });
    });
  }

  listSurveyResponses(organizationId: string, surveyId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadSurvey(tx, organizationId, surveyId);
      return tx.alumniSurveyResponse.findMany({
        where: { surveyId },
        include: { alumniProfile: { include: { student: true } } },
        orderBy: { submittedAt: "desc" },
      });
    });
  }

  private async submitSurveyResponse(
    organizationId: string,
    surveyId: string,
    alumniProfileId: string,
    dto: SubmitSurveyResponseDto,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const survey = await this.loadSurvey(tx, organizationId, surveyId);
      if (survey.status !== "PUBLISHED") throw new BadRequestException("This survey isn't accepting responses");
      const existing = await tx.alumniSurveyResponse.findUnique({
        where: { surveyId_alumniProfileId: { surveyId, alumniProfileId } },
      });
      if (existing) throw new ConflictException("You've already responded to this survey");
      return tx.alumniSurveyResponse.create({
        data: {
          organizationId,
          surveyId,
          alumniProfileId,
          answers: dto.answers as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  // ── Mentorship (Phase 8 slice 8b) ────────────────────────────────

  async createMentorship(organizationId: string, dto: CreateMentorshipDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, dto.mentorAlumniProfileId);
      const mentee = await tx.student.findUnique({ where: { id: dto.menteeStudentId } });
      if (!mentee || mentee.organizationId !== organizationId) throw new NotFoundException("Student not found");
      return tx.alumniMentorship.create({
        data: {
          organizationId,
          mentorAlumniProfileId: dto.mentorAlumniProfileId,
          menteeStudentId: dto.menteeStudentId,
          topic: dto.topic,
        },
        include: { mentorAlumniProfile: { include: { student: true } }, menteeStudent: true },
      });
    });
  }

  listMentorships(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniMentorship.findMany({
        where: { organizationId },
        include: { mentorAlumniProfile: { include: { student: true } }, menteeStudent: true },
        orderBy: { requestedAt: "desc" },
      }),
    );
  }

  async respondMentorship(organizationId: string, id: string, dto: RespondMentorshipDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await this.loadMentorship(tx, organizationId, id);
      if (record.status !== "REQUESTED") throw new ConflictException("This mentorship request has already been responded to");
      return tx.alumniMentorship.update({
        where: { id },
        data: { status: dto.status, respondedAt: new Date() },
        include: { mentorAlumniProfile: { include: { student: true } }, menteeStudent: true },
      });
    });
  }

  async completeMentorship(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await this.loadMentorship(tx, organizationId, id);
      if (record.status !== "ACTIVE") throw new ConflictException("Only an ACTIVE mentorship can be completed");
      return tx.alumniMentorship.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: { mentorAlumniProfile: { include: { student: true } }, menteeStudent: true },
      });
    });
  }

  // ── Achievements ──────────────────────────────────────────────────

  async addAchievement(organizationId: string, profileId: string, dto: CreateAchievementDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      return tx.alumniAchievement.create({
        data: {
          organizationId,
          alumniProfileId: profileId,
          title: dto.title,
          description: dto.description,
          achievedAt: dto.achievedAt ? new Date(dto.achievedAt) : undefined,
        },
      });
    });
  }

  async removeAchievement(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.alumniAchievement.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Achievement not found");
      return tx.alumniAchievement.delete({ where: { id } });
    });
  }

  // ── Self-service, part 2 (surveys/mentorship/achievements) ───────

  async submitOwnSurveyResponse(organizationId: string, studentId: string, surveyId: string, dto: SubmitSurveyResponseDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.submitSurveyResponse(organizationId, surveyId, profile.id, dto);
  }

  async listOwnMentorshipsAsMentor(organizationId: string, studentId: string) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniMentorship.findMany({
        where: { mentorAlumniProfileId: profile.id },
        include: { menteeStudent: true },
        orderBy: { requestedAt: "desc" },
      }),
    );
  }

  async respondOwnMentorship(organizationId: string, studentId: string, id: string, dto: RespondMentorshipDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await this.loadMentorship(tx, organizationId, id);
      if (record.mentorAlumniProfileId !== profile.id) throw new NotFoundException("Mentorship request not found");
      if (record.status !== "REQUESTED") throw new ConflictException("This mentorship request has already been responded to");
      return tx.alumniMentorship.update({
        where: { id },
        data: { status: dto.status, respondedAt: new Date() },
        include: { menteeStudent: true },
      });
    });
  }

  async completeOwnMentorship(organizationId: string, studentId: string, id: string) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await this.loadMentorship(tx, organizationId, id);
      if (record.mentorAlumniProfileId !== profile.id) throw new NotFoundException("Mentorship request not found");
      if (record.status !== "ACTIVE") throw new ConflictException("Only an ACTIVE mentorship can be completed");
      return tx.alumniMentorship.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: { menteeStudent: true },
      });
    });
  }

  // A current student's own mentorships-as-mentee — no AlumniProfile
  // needed since a mentee is just a Student, not necessarily graduated.
  listOwnMentorshipsAsMentee(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.alumniMentorship.findMany({
        where: { menteeStudentId: studentId },
        include: { mentorAlumniProfile: { include: { student: true } } },
        orderBy: { requestedAt: "desc" },
      }),
    );
  }

  async addOwnAchievement(organizationId: string, studentId: string, dto: CreateAchievementDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.addAchievement(organizationId, profile.id, dto);
  }

  // ── Career opportunities (Phase 8 slice 8c) ───────────────────────

  createOpportunity(organizationId: string, dto: CreateOpportunityDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCompany(tx, organizationId, dto.companyId);
      return tx.careerOpportunity.create({
        data: {
          organizationId,
          companyId: dto.companyId,
          title: dto.title,
          type: dto.type,
          description: dto.description,
          location: dto.location,
          status: "APPROVED",
        },
        include: { company: true },
      });
    });
  }

  async createOwnOpportunity(organizationId: string, studentId: string, dto: CreateOpportunityDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadCompany(tx, organizationId, dto.companyId);
      return tx.careerOpportunity.create({
        data: {
          organizationId,
          postedByAlumniProfileId: profile.id,
          companyId: dto.companyId,
          title: dto.title,
          type: dto.type,
          description: dto.description,
          location: dto.location,
          status: "PENDING",
        },
        include: { company: true },
      });
    });
  }

  listOpportunities(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.careerOpportunity.findMany({
        where: { organizationId },
        include: { company: true, postedByAlumniProfile: { include: { student: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  // Self-service list — APPROVED (open) and CLOSED (so a past
  // applicant can still see what they applied to) are visible; PENDING
  // (awaiting review) and REJECTED are not, same "don't leak
  // unpublished content" reasoning as listPublishedSurveys.
  listApprovedOpportunities(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.careerOpportunity.findMany({
        where: { organizationId, status: { in: ["APPROVED", "CLOSED"] } },
        include: { company: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async reviewOpportunity(organizationId: string, id: string, dto: ReviewOpportunityDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const opportunity = await this.loadOpportunity(tx, organizationId, id);
      if (opportunity.status !== "PENDING") throw new ConflictException("Only a PENDING opportunity can be reviewed");
      return tx.careerOpportunity.update({ where: { id }, data: { status: dto.status }, include: { company: true } });
    });
  }

  async closeOpportunity(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const opportunity = await this.loadOpportunity(tx, organizationId, id);
      if (opportunity.status !== "APPROVED") throw new ConflictException("Only an APPROVED opportunity can be closed");
      return tx.careerOpportunity.update({ where: { id }, data: { status: "CLOSED" }, include: { company: true } });
    });
  }

  // ── Career applications ────────────────────────────────────────────

  async applyToOpportunity(organizationId: string, studentId: string, opportunityId: string, dto: CreateApplicationDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const opportunity = await this.loadOpportunity(tx, organizationId, opportunityId);
      if (opportunity.status !== "APPROVED") throw new BadRequestException("This opportunity isn't accepting applications");
      const existing = await tx.careerApplication.findUnique({
        where: { opportunityId_applicantStudentId: { opportunityId, applicantStudentId: studentId } },
      });
      if (existing) throw new ConflictException("You've already applied to this opportunity");
      return tx.careerApplication.create({
        data: { organizationId, opportunityId, applicantStudentId: studentId, coverNote: dto.coverNote },
      });
    });
  }

  listApplicationsForOpportunity(organizationId: string, opportunityId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadOpportunity(tx, organizationId, opportunityId);
      return tx.careerApplication.findMany({
        where: { opportunityId },
        include: { applicantStudent: true },
        orderBy: { submittedAt: "desc" },
      });
    });
  }

  async updateApplicationStatus(organizationId: string, id: string, dto: UpdateApplicationStatusDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const application = await this.loadApplication(tx, organizationId, id);
      if (["REJECTED", "ACCEPTED", "WITHDRAWN"].includes(application.status)) {
        throw new ConflictException("This application has already reached a final status");
      }
      return tx.careerApplication.update({
        where: { id },
        data: { status: dto.status, reviewNotes: dto.reviewNotes, reviewedAt: new Date() },
        include: { applicantStudent: true },
      });
    });
  }

  listOwnApplications(organizationId: string, studentId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.careerApplication.findMany({
        where: { applicantStudentId: studentId },
        include: { opportunity: { include: { company: true } } },
        orderBy: { submittedAt: "desc" },
      }),
    );
  }

  async withdrawOwnApplication(organizationId: string, studentId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const application = await this.loadApplication(tx, organizationId, id);
      if (application.applicantStudentId !== studentId) throw new NotFoundException("Application not found");
      if (["REJECTED", "ACCEPTED", "WITHDRAWN"].includes(application.status)) {
        throw new ConflictException("This application has already reached a final status");
      }
      return tx.careerApplication.update({ where: { id }, data: { status: "WITHDRAWN" } });
    });
  }

  // ── Career services (simple catalog, no booking) ──────────────────

  createCareerService(organizationId: string, dto: CreateCareerServiceDto) {
    return this.prisma.withTenant(organizationId, (tx) => tx.careerService.create({ data: { organizationId, ...dto } }));
  }

  listCareerServices(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.careerService.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  listActiveCareerServices(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.careerService.findMany({ where: { organizationId, isActive: true }, orderBy: { name: "asc" } }),
    );
  }

  async updateCareerService(organizationId: string, id: string, dto: UpdateCareerServiceDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const record = await tx.careerService.findUnique({ where: { id } });
      if (!record || record.organizationId !== organizationId) throw new NotFoundException("Career service not found");
      return tx.careerService.update({ where: { id }, data: dto });
    });
  }

  // ── Graduate outcomes ──────────────────────────────────────────────

  async setGraduateOutcome(organizationId: string, profileId: string, dto: SetGraduateOutcomeDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      await this.loadProfile(tx, organizationId, profileId);
      return tx.graduateOutcome.upsert({
        where: { alumniProfileId: profileId },
        update: { ...dto },
        create: { organizationId, alumniProfileId: profileId, ...dto },
      });
    });
  }

  async setOwnGraduateOutcome(organizationId: string, studentId: string, dto: SetGraduateOutcomeDto) {
    const profile = await this.getOwnProfile(organizationId, studentId);
    return this.setGraduateOutcome(organizationId, profile.id, dto);
  }

  // ── FK-vs-RLS parent guard ───────────────────────────────────────

  private async loadProfile(tx: PrismaClient, organizationId: string, id: string) {
    const profile = await tx.alumniProfile.findUnique({ where: { id } });
    if (!profile || profile.organizationId !== organizationId) throw new NotFoundException("Alumni profile not found");
    return profile;
  }

  private async loadSurvey(tx: PrismaClient, organizationId: string, id: string) {
    const survey = await tx.alumniSurvey.findUnique({ where: { id } });
    if (!survey || survey.organizationId !== organizationId) throw new NotFoundException("Survey not found");
    return survey;
  }

  private async loadMentorship(tx: PrismaClient, organizationId: string, id: string) {
    const record = await tx.alumniMentorship.findUnique({ where: { id } });
    if (!record || record.organizationId !== organizationId) throw new NotFoundException("Mentorship record not found");
    return record;
  }

  private async loadCompany(tx: PrismaClient, organizationId: string, id: string) {
    const company = await tx.alumniCompany.findUnique({ where: { id } });
    if (!company || company.organizationId !== organizationId) throw new NotFoundException("Company not found");
    return company;
  }

  private async loadOpportunity(tx: PrismaClient, organizationId: string, id: string) {
    const opportunity = await tx.careerOpportunity.findUnique({ where: { id } });
    if (!opportunity || opportunity.organizationId !== organizationId) throw new NotFoundException("Opportunity not found");
    return opportunity;
  }

  private async loadApplication(tx: PrismaClient, organizationId: string, id: string) {
    const application = await tx.careerApplication.findUnique({ where: { id } });
    if (!application || application.organizationId !== organizationId) throw new NotFoundException("Application not found");
    return application;
  }
}
