import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  providers: [NotificationsService],
  controllers: [NotificationsController],
  // Reused by teacher-portal (publish/grade notifications) and
  // DiscussionsService (reply notifications) — the write side has no
  // self-service guard of its own (see NotificationsService's own
  // comment), so nothing else needs wiring here.
  exports: [NotificationsService],
})
export class NotificationsModule {}
