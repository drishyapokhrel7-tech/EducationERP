import { IsString } from "class-validator";

export class AssignStudentTransportDto {
  @IsString()
  studentEnrollmentId!: string;

  @IsString()
  routeId!: string;

  @IsString()
  stopId!: string;
}
