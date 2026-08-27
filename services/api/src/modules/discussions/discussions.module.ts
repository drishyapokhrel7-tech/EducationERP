import { Module } from "@nestjs/common";
import { DiscussionsService } from "./discussions.service";

// No controller — consumed only by teacher-portal (topic CRUD + posting
// as the owning teacher) and student-portal (published topics + posting
// as an enrolled student), same shape as AiGatewayModule.
@Module({
  providers: [DiscussionsService],
  exports: [DiscussionsService],
})
export class DiscussionsModule {}
