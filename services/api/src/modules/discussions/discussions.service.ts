import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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

  createPost(
    organizationId: string,
    topicId: string,
    author: { studentId?: string; employeeId?: string },
    dto: CreateDiscussionPostDto,
  ) {
    return this.prisma.withTenant(organizationId, (tx) =>
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
  }
}
