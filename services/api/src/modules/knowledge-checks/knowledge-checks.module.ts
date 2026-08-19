import { Module } from "@nestjs/common";
import { KnowledgeChecksService } from "./knowledge-checks.service";
import { KnowledgeChecksController } from "./knowledge-checks.controller";

@Module({
  providers: [KnowledgeChecksService],
  controllers: [KnowledgeChecksController],
})
export class KnowledgeChecksModule {}
