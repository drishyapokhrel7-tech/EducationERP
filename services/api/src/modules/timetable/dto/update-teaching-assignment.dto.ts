import { IsOptional, IsString } from "class-validator";

export class UpdateTeachingAssignmentDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;
}
