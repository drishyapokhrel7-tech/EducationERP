import { IsString } from "class-validator";

export class CreateTeachingAssignmentDto {
  @IsString()
  employeeId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  sectionId!: string;

  @IsString()
  semesterId!: string;
}
