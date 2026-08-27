import { Controller, Get, Param } from "@nestjs/common";
import { DocumentsService } from "./documents.service";

// Deliberately outside "organizations/me" and with no guards at all —
// a third party (an employer, another institution) verifying a
// printed certificate has no account and no tenant context. See the
// Certificate model's own schema.prisma comment for why this table
// has no RLS, which is what makes this lookup possible at all.
@Controller("verify")
export class CertificateVerificationController {
  constructor(private readonly documents: DocumentsService) {}

  @Get("certificates/:code")
  verify(@Param("code") code: string) {
    return this.documents.verifyCertificate(code);
  }
}
