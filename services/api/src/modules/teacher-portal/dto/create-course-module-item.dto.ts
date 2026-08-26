import { CourseModuleItemType } from "@prisma/client";
import { IsEnum, IsInt, IsPositive, IsString, MinLength } from "class-validator";

export class CreateCourseModuleItemDto {
  @IsInt()
  @IsPositive()
  sequence!: number;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(CourseModuleItemType)
  type!: CourseModuleItemType;

  // Rich text for PAGE, a URL for LINK/VIDEO/DOCUMENT — see the
  // schema's own comment on why this project links rather than
  // uploads (no object storage exists yet).
  @IsString()
  @MinLength(1)
  content!: string;
}
