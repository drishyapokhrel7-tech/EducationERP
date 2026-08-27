import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDiscussionTopicDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
