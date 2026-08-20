import { IsString, MinLength } from "class-validator";

export class CreateStudentLoginDto {
  // Admin sets this directly and relays it to the student out of band —
  // the API never generates or echoes a password back (plan §7: never
  // expose passwords in responses/logs).
  @IsString()
  @MinLength(8)
  password!: string;
}
