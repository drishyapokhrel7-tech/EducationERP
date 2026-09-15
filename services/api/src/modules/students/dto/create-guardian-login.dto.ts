import { IsString, MinLength } from "class-validator";

export class CreateGuardianLoginDto {
  // Admin sets this directly and relays it to the guardian out of band —
  // same reasoning as CreateStudentLoginDto: the API never generates or
  // echoes a password back.
  @IsString()
  @MinLength(8)
  password!: string;
}
