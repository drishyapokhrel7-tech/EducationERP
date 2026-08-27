import { IsOptional, IsString } from "class-validator";

export class CreateMentorshipDto {
  @IsString()
  mentorAlumniProfileId!: string;

  @IsString()
  menteeStudentId!: string;

  @IsOptional()
  @IsString()
  topic?: string;
}
