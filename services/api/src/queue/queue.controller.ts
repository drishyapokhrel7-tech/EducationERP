import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { HEALTH_QUEUE } from "./queue.constants";
import { HealthPingData, HealthPingResult } from "./health-queue.types";

/**
 * Proves the Redis/BullMQ wiring end to end: enqueue → worker processes
 * → result readable back. Not a real domain feature — later phases add
 * actual job queues (AI/document/CCTV processing per plan §2).
 */
@Controller("queue/health")
export class QueueController {
  constructor(
    @InjectQueue(HEALTH_QUEUE)
    private readonly healthQueue: Queue<HealthPingData, HealthPingResult>,
  ) {}

  @Get("ping")
  async ping() {
    const job = await this.healthQueue.add("ping", { pingedAt: new Date().toISOString() });
    return { jobId: job.id };
  }

  @Get(":jobId")
  async status(@Param("jobId") jobId: string) {
    const job = await this.healthQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return {
      id: job.id,
      state: await job.getState(),
      returnvalue: job.returnvalue,
    };
  }
}
