import { IsEnum } from "class-validator";
import { FaceMatchReviewDecision } from "@prisma/client";

export class ReviewFaceMatchDto {
  @IsEnum(FaceMatchReviewDecision)
  decision!: FaceMatchReviewDecision;
}
