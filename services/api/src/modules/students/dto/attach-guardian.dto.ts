import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class AttachGuardianDto {
  @IsString()
  guardianId!: string;

  @IsString()
  @MinLength(1)
  relationship!: string;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;
}
