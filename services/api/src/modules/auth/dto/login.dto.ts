import { IsString, MinLength } from "class-validator";

export class LoginDto {
  // Either a User.email or a User.username (self-service logins, e.g.
  // students, log in by username — not every login is email-shaped, so
  // this can't be @IsEmail()).
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
