import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DeliveryProvider } from "./delivery-provider";
import { CreateMessageTemplateDto } from "./dto/create-message-template.dto";
import { CreateMessageDto } from "./dto/create-message.dto";

// `select`, not `include: true`, on both user relations — a plain
// `include` would pull back passwordHash along with everything else,
// same pitfall this project's own RBAC/staff/students services
// already avoid the same way.
const USER_SUMMARY_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

const MESSAGE_INCLUDE = {
  template: true,
  createdBy: { select: USER_SUMMARY_SELECT },
  recipientUser: { select: USER_SUMMARY_SELECT },
  emailLogs: true,
  smsLogs: true,
  pushLogs: true,
};

/**
 * Contact-field resolution is genuinely uneven across this project's
 * existing models (see the schema.prisma comment on the Communication
 * section for the full breakdown): Employee has email+phone+optional
 * userId; Student has neither, only an optional userId; Guardian has
 * phone+optional email but no userId at all. UNRESOLVABLE_COMBINATIONS
 * below are the (audience, channel) pairs with no contact path at all
 * in this data model — rejected outright (400) rather than silently
 * sending to nobody. A resolvable audience whose *individual* members
 * are missing the needed field are just skipped, not an error.
 */
const UNRESOLVABLE: Array<{ audience: string; channel: string }> = [
  { audience: "ALL_STUDENTS", channel: "SMS" }, // Student has no phone field anywhere
  { audience: "ALL_GUARDIANS", channel: "PUSH" }, // Guardian has no User account
  { audience: "ALL_GUARDIANS", channel: "IN_APP" },
  { audience: "SPECIFIC_USER", channel: "SMS" }, // User has no phone field
];

@Injectable()
export class CommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly delivery: DeliveryProvider,
  ) {}

  // ── Message templates ─────────────────────────────────────────────

  createTemplate(organizationId: string, dto: CreateMessageTemplateDto) {
    return this.prisma.withTenant(organizationId, (tx) => tx.messageTemplate.create({ data: { organizationId, ...dto } }));
  }

  listTemplates(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.messageTemplate.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    );
  }

  // ── Messages ──────────────────────────────────────────────────────

  async createMessage(organizationId: string, userId: string, dto: CreateMessageDto) {
    if (dto.audience === "SPECIFIC_USER" && !dto.recipientUserId) {
      throw new BadRequestException("recipientUserId is required when audience is SPECIFIC_USER");
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      let subject = dto.subject;
      let body = dto.body;

      if (dto.templateId) {
        const template = await tx.messageTemplate.findUnique({ where: { id: dto.templateId } });
        if (!template || template.organizationId !== organizationId) throw new NotFoundException("Template not found");
        if (template.channel !== dto.channel) {
          throw new BadRequestException(`This template is for ${template.channel}, not ${dto.channel}`);
        }
        // The template's content is copied in, not live-referenced —
        // same "snapshot at composition time" precedent as
        // PayrollItem snapshotting SalaryStructureItem — editing the
        // template later never retroactively changes a message
        // already drafted from it.
        subject = subject ?? template.subject ?? undefined;
        body = body ?? template.body;
      }

      if (dto.audience === "SPECIFIC_USER" && dto.recipientUserId) {
        const recipient = await tx.user.findUnique({ where: { id: dto.recipientUserId } });
        if (!recipient || recipient.organizationId !== organizationId) throw new NotFoundException("Recipient user not found");
      }

      if (!body) throw new BadRequestException("A message needs a body, or a templateId that supplies one");

      return tx.message.create({
        data: {
          organizationId,
          createdByUserId: userId,
          templateId: dto.templateId,
          channel: dto.channel,
          audience: dto.audience,
          recipientUserId: dto.audience === "SPECIFIC_USER" ? dto.recipientUserId : undefined,
          subject,
          body,
        },
        include: MESSAGE_INCLUDE,
      });
    });
  }

  listMessages(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.message.findMany({ where: { organizationId }, include: MESSAGE_INCLUDE, orderBy: { createdAt: "desc" } }),
    );
  }

  async sendMessage(organizationId: string, messageId: string) {
    const message = await this.prisma.withTenant(organizationId, (tx) => tx.message.findUnique({ where: { id: messageId } }));
    if (!message || message.organizationId !== organizationId) throw new NotFoundException("Message not found");
    if (message.status !== "DRAFT") throw new ConflictException("Only a DRAFT message can be sent");

    const unresolvable = UNRESOLVABLE.some((u) => u.audience === message.audience && u.channel === message.channel);
    if (unresolvable) {
      throw new BadRequestException(
        `${message.audience} has no ${message.channel} contact path in this system — pick a different channel`,
      );
    }

    const recipients = await this.resolveRecipients(organizationId, message.audience, message.recipientUserId);

    return this.prisma.withTenant(organizationId, async (tx) => {
      if (message.channel === "IN_APP") {
        for (const r of recipients) {
          if (r.userId) {
            await this.notifications.notify(organizationId, r.userId, {
              type: "MESSAGE",
              title: message.subject ?? "New message",
              body: message.body,
            });
          }
        }
      } else if (message.channel === "EMAIL") {
        for (const r of recipients) {
          if (!r.email) continue;
          const result = await this.delivery.sendEmail(r.email, message.subject ?? null, message.body);
          await tx.emailLog.create({
            data: {
              organizationId,
              messageId,
              recipientEmail: r.email,
              recipientName: r.name,
              status: result.status,
              providerResponse: result.providerResponse,
            },
          });
        }
      } else if (message.channel === "SMS") {
        for (const r of recipients) {
          if (!r.phone) continue;
          const result = await this.delivery.sendSms(r.phone, message.body);
          await tx.smsLog.create({
            data: {
              organizationId,
              messageId,
              recipientPhone: r.phone,
              recipientName: r.name,
              status: result.status,
              providerResponse: result.providerResponse,
            },
          });
        }
      } else if (message.channel === "PUSH") {
        for (const r of recipients) {
          if (!r.userId) continue;
          const result = await this.delivery.sendPush(r.userId, message.subject ?? null, message.body);
          await tx.pushNotificationLog.create({
            data: {
              organizationId,
              messageId,
              recipientUserId: r.userId,
              status: result.status,
              providerResponse: result.providerResponse,
            },
          });
        }
      }

      return tx.message.update({
        where: { id: messageId },
        data: { status: "SENT", sentAt: new Date() },
        include: MESSAGE_INCLUDE,
      });
    });
  }

  // ── Recipient resolution ─────────────────────────────────────────

  private async resolveRecipients(
    organizationId: string,
    audience: string,
    specificUserId: string | null,
  ): Promise<Array<{ userId?: string; email?: string; phone?: string; name?: string }>> {
    return this.prisma.withTenant(organizationId, async (tx: PrismaClient) => {
      if (audience === "SPECIFIC_USER") {
        const user = await tx.user.findUnique({ where: { id: specificUserId! }, include: { employee: true } });
        if (!user) return [];
        // Staff logins are created against a synthetic
        // `{username}@employee.local` address (StaffService.createLogin)
        // so User.email is never real for them — prefer the linked
        // Employee's actual business email when one exists. A student
        // login has no such fallback (Student carries no email field
        // of its own), so User.email is genuinely the only address
        // there is for a student SPECIFIC_USER target.
        const email = user.employee?.email ?? user.email;
        return [{ userId: user.id, email, name: `${user.firstName} ${user.lastName}` }];
      }

      if (audience === "ALL_STAFF") {
        const employees = await tx.employee.findMany({ where: { organizationId, status: "ACTIVE" } });
        return employees.map((e) => ({
          userId: e.userId ?? undefined,
          email: e.email,
          phone: e.phone ?? undefined,
          name: `${e.firstName} ${e.lastName}`,
        }));
      }

      if (audience === "ALL_STUDENTS") {
        const students = await tx.student.findMany({ where: { organizationId, status: "ACTIVE" }, include: { user: true } });
        return students.map((s) => ({
          userId: s.userId ?? undefined,
          email: s.user?.email,
          name: `${s.firstName} ${s.lastName}`,
        }));
      }

      if (audience === "ALL_GUARDIANS") {
        const guardians = await tx.guardian.findMany({ where: { organizationId } });
        return guardians.map((g) => ({
          email: g.email ?? undefined,
          phone: g.phone,
          name: `${g.firstName} ${g.lastName}`,
        }));
      }

      return [];
    });
  }
}
