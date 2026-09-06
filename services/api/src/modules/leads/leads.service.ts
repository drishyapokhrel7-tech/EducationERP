import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeadDto } from "./dto/create-lead.dto";

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  // Not tenant data — no withTenant/organizationId, same as
  // PlatformAdmin/Captcha (every other genuinely global table in this
  // schema).
  create(dto: CreateLeadDto) {
    return this.prisma.leadSubmission.create({
      data: {
        source: dto.source,
        name: dto.name,
        email: dto.email,
        company: dto.company,
        message: dto.message,
      },
      select: { id: true, createdAt: true },
    });
  }
}
