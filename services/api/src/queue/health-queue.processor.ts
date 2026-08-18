import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { HEALTH_QUEUE } from "./queue.constants";
import { HealthPingData, HealthPingResult } from "./health-queue.types";

@Processor(HEALTH_QUEUE)
export class HealthQueueProcessor extends WorkerHost {
  process(job: Job<HealthPingData>): Promise<HealthPingResult> {
    return Promise.resolve({
      pong: true,
      pingedAt: job.data.pingedAt,
      processedAt: new Date().toISOString(),
    });
  }
}
