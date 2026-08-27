import { IsString } from "class-validator";

export class AllocateBedDto {
  @IsString()
  studentEnrollmentId!: string;

  @IsString()
  bedId!: string;
}
