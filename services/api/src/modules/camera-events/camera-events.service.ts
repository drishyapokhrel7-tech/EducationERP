import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { FaceMatchResult } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { CreateCameraDto } from "./dto/create-camera.dto";
import { ReviewFaceMatchDto } from "./dto/review-face-match.dto";

// Below matchConfidenceThreshold (org policy, slice 6a) but within this
// band, a match is uncertain enough to need a human decision rather
// than being auto-classified either way — the architecture doc's
// explicit "possible match, human review" requirement. A fixed
// constant this slice (see plan's "explicitly not in this slice");
// matchConfidenceThreshold itself stays admin-configurable.
const POSSIBLE_MATCH_BAND = 0.15;

interface BestMatch {
  faceEnrollmentId: string;
  similarity: number;
}

/**
 * Camera capture + face matching (Phase 6 slice 6c) — where 6a's
 * consent/policy and 6b's embedding service actually connect. The
 * ingestion endpoint is deliberately adapter-agnostic: it doesn't know
 * or care whether an image arrived from a real camera or a plain
 * upload, which is what makes it double as the plan's "simulated
 * camera source" with no separate simulator tool needed.
 */
@Injectable()
export class CameraEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  createCamera(organizationId: string, dto: CreateCameraDto) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.camera.create({
        data: { organizationId, name: dto.name, location: dto.location, adapterType: dto.adapterType },
      }),
    );
  }

  listCameras(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.camera.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    );
  }

  async ingestEvent(
    organizationId: string,
    cameraId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const camera = await tx.camera.findUnique({ where: { id: cameraId } });
      if (!camera) throw new NotFoundException("Camera not found");

      const policy = await tx.biometricPolicy.findUnique({ where: { organizationId } });
      if (!policy?.enabled) {
        throw new BadRequestException("Biometric capture is disabled for this organization");
      }

      const result = await this.aiGateway.embedFaces(file.buffer, file.originalname, file.mimetype);

      const cameraEvent = await tx.cameraEvent.create({
        data: { organizationId, cameraId, capturedAt: new Date() },
      });

      const matches = [];
      let anyUncertain = false;
      for (const face of result.faces) {
        const embeddingLiteral = `[${face.embedding.join(",")}]`;
        const rows = await tx.$queryRawUnsafe<BestMatch[]>(
          `SELECT fe."faceEnrollmentId" AS "faceEnrollmentId", 1 - (fe."embedding" <=> $1::vector) AS similarity
           FROM "face_embeddings" fe
           WHERE fe."organizationId" = $2
           ORDER BY fe."embedding" <=> $1::vector
           LIMIT 1`,
          embeddingLiteral,
          organizationId,
        );
        const best = rows[0];
        const similarity = best?.similarity ?? 0;

        let matchResult: FaceMatchResult;
        let matchedEnrollmentId: string | null = null;
        if (best && similarity >= policy.matchConfidenceThreshold) {
          matchResult = FaceMatchResult.IDENTIFIED;
          matchedEnrollmentId = best.faceEnrollmentId;
        } else if (best && similarity >= policy.matchConfidenceThreshold - POSSIBLE_MATCH_BAND) {
          matchResult = FaceMatchResult.POSSIBLE_MATCH;
          matchedEnrollmentId = best.faceEnrollmentId;
          anyUncertain = true;
        } else {
          matchResult = FaceMatchResult.UNKNOWN;
          anyUncertain = true;
        }

        const match = await tx.faceMatchEvent.create({
          data: {
            organizationId,
            cameraEventId: cameraEvent.id,
            matchedEnrollmentId,
            confidence: similarity,
            result: matchResult,
          },
          include: { matchedEnrollment: { include: { student: true, staff: true } } },
        });
        matches.push(match);
      }

      // Discarded by default (nothing written) — kept only when at
      // least one face in this frame is uncertain, so a human reviewer
      // has something to look at. Confirmed with the user before this
      // slice was planned.
      const finalEvent = anyUncertain
        ? await tx.cameraEvent.update({
            where: { id: cameraEvent.id },
            data: { capturedImage: new Uint8Array(file.buffer), capturedImageType: file.mimetype },
          })
        : cameraEvent;

      return { ...finalEvent, capturedImage: undefined, hasImage: anyUncertain, matches };
    });
  }

  listFaceMatchEvents(organizationId: string) {
    return this.prisma.withTenant(organizationId, (tx) =>
      tx.faceMatchEvent.findMany({
        where: { organizationId },
        include: {
          matchedEnrollment: { include: { student: true, staff: true } },
          cameraEvent: { include: { camera: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getFaceMatchImage(organizationId: string, id: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const match = await tx.faceMatchEvent.findUnique({
        where: { id },
        include: { cameraEvent: true },
      });
      if (!match) throw new NotFoundException("Match event not found");
      if (!match.cameraEvent.capturedImage) throw new NotFoundException("No image was kept for this event");
      return {
        buffer: match.cameraEvent.capturedImage,
        mimetype: match.cameraEvent.capturedImageType ?? "application/octet-stream",
      };
    });
  }

  async reviewFaceMatch(organizationId: string, userId: string, id: string, dto: ReviewFaceMatchDto) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const match = await tx.faceMatchEvent.findUnique({ where: { id } });
      if (!match) throw new NotFoundException("Match event not found");
      if (match.result !== FaceMatchResult.POSSIBLE_MATCH) {
        throw new BadRequestException("Only a possible-match event can be reviewed");
      }
      if (match.reviewedAt) {
        throw new ConflictException("This match has already been reviewed");
      }

      const updated = await tx.faceMatchEvent.update({
        where: { id },
        data: { reviewedAt: new Date(), reviewedBy: userId, reviewDecision: dto.decision },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "face_match_event.reviewed",
          resource: "face_match_event",
          resourceId: id,
          metadata: { decision: dto.decision },
        },
      });
      return updated;
    });
  }
}
