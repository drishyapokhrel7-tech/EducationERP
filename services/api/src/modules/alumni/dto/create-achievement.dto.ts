import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAchievementDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  achievedAt?: string;
}
