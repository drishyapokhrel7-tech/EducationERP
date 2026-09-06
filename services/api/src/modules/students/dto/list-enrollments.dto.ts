import { IsEnum, IsOptional, IsString } from "class-validator";
import { EnrollmentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

// Backs the Enrollment card's real list view — filterable so an admin
// can actually see who's enrolled in a given program/semester/section
// instead of a create form with no way to check afterward.
export class ListEnrollmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
