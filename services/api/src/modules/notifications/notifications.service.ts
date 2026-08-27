import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * No self-service ownership check needed on the write side — unlike
 * every other reused service in this project, callers here (teacher-
 * portal, DiscussionsService) never pass a userId supplied by the
 * *recipient*; they only ever notify students/employees they've
 * already verified belong to the course in question. The read side
 * (list/markRead/markAllRead) is the one that's genuinely self-service,
 * gated by the caller's own userId, exposed directly through
 * NotificationsController below.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  notify(organizationId: string, userId: string, input: NotificationInput) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.notification.create({ data: { organizationId, userId, ...input } }),
    );
  }

  // Fans a single notification out to every actively-enrolled student
  // in one course who has a portal login — the same "no linked User,
  // no notification" rule that already applies everywhere else
  // self-service logins are optional. `excludeUserId` skips the actor
  // themselves (e.g. a student's own reply shouldn't notify the poster).
  async notifyEnrolledStudents(
    organizationId: string,
    teachingAssignmentId: string,
    input: NotificationInput,
    excludeUserId?: string,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const ta = await tx.teachingAssignment.findUnique({ where: { id: teachingAssignmentId } });
      if (!ta) return;

      const enrollments = await tx.studentEnrollment.findMany({
        where: { organizationId, sectionId: ta.sectionId, termId: ta.termId, status: "ACTIVE" },
        include: { student: true },
      });
      const recipientUserIds = [...new Set(enrollments.map((e) => e.student.userId).filter((id): id is string => !!id))].filter(
        (id) => id !== excludeUserId,
      );
      if (recipientUserIds.length === 0) return;

      await tx.notification.createMany({
        data: recipientUserIds.map((userId) => ({ organizationId, userId, ...input })),
      });
    });
  }

  listMine(organizationId: string, userId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.notification.findMany({ where: { organizationId, userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    );
  }

  async markRead(organizationId: string, userId: string, notificationId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const notification = await tx.notification.findUnique({ where: { id: notificationId } });
      if (!notification || notification.userId !== userId) {
        throw new NotFoundException("Notification not found");
      }
      return tx.notification.update({ where: { id: notificationId }, data: { isRead: true } });
    });
  }

  markAllRead(organizationId: string, userId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.notification.updateMany({ where: { organizationId, userId, isRead: false }, data: { isRead: true } }),
    );
  }
}
