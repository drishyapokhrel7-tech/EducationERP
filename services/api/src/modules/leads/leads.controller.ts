import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { LeadsService } from "./leads.service";
import { CreateLeadDto } from "./dto/create-lead.dto";

@Controller("public/leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // No auth guard — this is a public marketing-site contact/demo/
  // feedback form submitting from a logged-out visitor, same
  // reasoning as auth/register-organization. Rate-limited well below
  // the global default: a real enquiry is a rare, deliberate action,
  // not something a legitimate caller ever needs to burst.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }
}
