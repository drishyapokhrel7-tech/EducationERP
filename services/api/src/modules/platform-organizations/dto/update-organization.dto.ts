import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Edition } from "@prisma/client";

// Hand-written, all-optional twin of RegisterOrganizationDto's
// name/slug fields (same validation rules) plus the edition field the
// original narrower DTO already had — same "twin of the Create DTO,
// every field @IsOptional()" convention as every other UpdateXDto in
// this codebase, not @nestjs/mapped-types (unused anywhere here).
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;

  @IsOptional()
  @IsEnum(Edition)
  edition?: Edition;
}
