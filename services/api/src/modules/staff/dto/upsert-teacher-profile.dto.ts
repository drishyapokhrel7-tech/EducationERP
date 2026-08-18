import { IsOptional, IsString } from "class-validator";

export class UpsertTeacherProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}
