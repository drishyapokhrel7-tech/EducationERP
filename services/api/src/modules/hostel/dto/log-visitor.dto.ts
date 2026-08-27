import { IsOptional, IsString, MinLength } from "class-validator";

export class LogVisitorDto {
  @IsString()
  @MinLength(1)
  visitorName!: string;

  @IsOptional()
  @IsString()
  relation?: string;
}
