import { IsEnum, IsOptional, IsString } from "class-validator";

export class ReviewDocumentDto {
  @IsEnum(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
