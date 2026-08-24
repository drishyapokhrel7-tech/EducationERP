import { IsString } from "class-validator";

export class AssignScholarshipDto {
  @IsString()
  scholarshipId!: string;
}
