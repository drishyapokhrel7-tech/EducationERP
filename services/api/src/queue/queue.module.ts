import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HEALTH_QUEUE } from "./queue.constants";
import { HealthQueueProcessor } from "./health-queue.processor";
import { QueueController } from "./queue.controller";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("REDIS_URL") ?? "redis://localhost:6379" },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_QUEUE }),
  ],
  providers: [HealthQueueProcessor],
  controllers: [QueueController],
  exports: [BullModule],
})
export class QueueModule {}
