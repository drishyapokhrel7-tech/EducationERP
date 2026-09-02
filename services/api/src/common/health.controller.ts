import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Real health check, not a placeholder — a load balancer/uptime
// monitor hitting `{status:"ok"}` unconditionally can't actually tell
// a healthy deploy from one whose database connection is down.
// `SELECT 1` is the one deliberate exception to this codebase's own
// no-raw-queries convention: it touches no tenant table, takes no
// user input, and is the standard minimal-overhead connectivity probe
// — not a precedent for raw queries elsewhere.
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch {
      throw new HttpException({ status: "error", database: "unreachable" }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
