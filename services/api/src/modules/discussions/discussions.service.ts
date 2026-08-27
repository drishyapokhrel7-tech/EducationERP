import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateDiscussionTopicDto } from "../teacher-portal/dto/create-discussion-topic.dto";
import { UpdateDiscussionTopicDto } from "../teacher-portal/dto/update-discussion-topic.dto";
import { CreateDiscussionPostDto } from "../teacher-portal/dto/create-discussion-post.dto";

const TOPIC_WITH_POSTS = {
  posts: {
    include: { authorStudent: true, authorEmployee: true },
    orderBy: { createdAt: "asc" as const },
  },
};

/**
 * No controller of its own — same "service-only, exported for other
 * modules to inject" shape as AiGatewayModule. Both teacher-portal and
 * student-portal need identical topic/post CRUD (just with a
 * different linked author), so the shared logic lives here rather
 * than being duplicated in two places; each portal still does its own
 * ownership/enrollment check *before* calling in, exactly like it
 * does before calling into AssignmentsService/KnowledgeChecksService
 * — this service trusts the caller has already verified access.
 */
@Injectable()
export class DiscussionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  listTopics(organizationId: string, teachingAssignmentId: string, publishedOnly: boolean) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.discussionTopic.findMany({
        where: {
          organizationId,
          teachingAssignmentId,
          ...(publishedOnly ? { isPublished: true } : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  createTopic(organizationId: string, dto: CreateDiscussionTopicDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.discussionTopic.create({
        data: {
          organizationId,
          teachingAssignmentId: dto.teachingAssignmentId,
          title: dto.title,
          body: dto.body,
        },
      }),
    );
  }

  updateTopic(organizationId: string, topicId: string, dto: UpdateDiscussionTopicDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.discussionTopic.update({
        where: { id: topicId },
        data: { title: dto.title, body: dto.body, isPublished: dto.isPublished },
      }),
    );
  }

  async getTopic(organizationId: string, topicId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const topic = await tx.discussionTopic.findUnique({ where: { id: topicId }, include: TOPIC_WITH_POSTS });
      if (!topic) throw new NotFoundException("Discussion topic not found");
      return topic;
    });
  }

  async createPost(
    organizationId: string,
    topicId: string,
    author: { studentId?: string; employeeId?: string },
    dto: CreateDiscussionPostDto,
  ) {
    const post = await this.prisma.withTenant(organizationId, (tx) =>
      tx.discussionPost.create({
        data: {
          organizationId,
          discussionTopicId: topicId,
          authorStudentId: author.studentId,
          authorEmployeeId: author.employeeId,
          body: dto.body,
        },
        include: { authorStudent: true, authorEmployee: true },
      }),
    );
    await this.notifyParticipants(organizationId, topicId, author);
    return post;
  }

  // Notifies everyone already in the conversation — the topic's owning
  // teacher plus every distinct prior poster — except whoever just
  // posted. One withTenant call gathers the data; the actual notify()
  // calls happen after it returns, never nested inside it (Prisma
  // doesn't support nested $transaction calls, same constraint this
  // project's other services already work around).
  private async notifyParticipants(
    organizationId: string,
    topicId: string,
    author: { studentId?: string; employeeId?: string },
  ) {
    const { recipientUserIds, topicTitle } = await this.prisma.withTenant(organizationId, async (tx) => {
      const topic = await tx.discussionTopic.findUnique({ where: { id: topicId }, include: { teachingAssignment: true } });
      if (!topic) return { recipientUserIds: [] as string[], topicTitle: "" };

      const posts = await tx.discussionPost.findMany({
        where: { discussionTopicId: topicId },
        include: { authorStudent: true, authorEmployee: true },
      });
      const owningEmployee = await tx.employee.findUnique({ where: { id: topic.teachingAssignment.employeeId } });

      const ids = new Set<string>();
      if (owningEmployee?.userId) ids.add(owningEmployee.userId);
      for (const p of posts) {
        if (p.authorStudent?.userId) ids.add(p.authorStudent.userId);
        if (p.authorEmployee?.userId) ids.add(p.authorEmployee.userId);
      }

      let actorUserId: string | null | undefined;
      if (author.studentId) {
        actorUserId = (await tx.student.findUnique({ where: { id: author.studentId } }))?.userId;
      } else if (author.employeeId) {
        actorUserId = (await tx.employee.findUnique({ where: { id: author.employeeId } }))?.userId;
      }
      if (actorUserId) ids.delete(actorUserId);

      return { recipientUserIds: [...ids], topicTitle: topic.title };
    });

    for (const userId of recipientUserIds) {
      await this.notifications.notify(organizationId, userId, {
        type: "discussion_reply",
        title: `New reply on "${topicTitle}"`,
        link: "/portal/discussions",
      });
    }
  }
}
