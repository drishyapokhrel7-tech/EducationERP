import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { CertificateVerificationController } from "./certificate-verification.controller";

@Module({
  providers: [DocumentsService],
  controllers: [DocumentsController, CertificateVerificationController],
  // Reused by StudentPortalModule for self-service document upload/
  // listing and own-certificates listing.
  exports: [DocumentsService],
})
export class DocumentsModule {}
