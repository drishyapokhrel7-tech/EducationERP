import { Module } from "@nestjs/common";
import { KnowledgeChecksService } from "./knowledge-checks.service";
import { KnowledgeChecksController } from "./knowledge-checks.controller";

@Module({
  providers: [KnowledgeChecksService],
  controllers: [KnowledgeChecksController],
  // Reused by teacher-portal (create/add-question/publish, ownership-
  // checked first) and student-portal (self-service quiz-taking,
  // enrollment-checked first) — same "reuse the existing service, add a
  // self-service guard in front" precedent as AssignmentsModule.
  exports: [KnowledgeChecksService],
})
export class KnowledgeChecksModule {}
