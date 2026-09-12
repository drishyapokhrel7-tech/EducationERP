import { IsEmail, MaxLength } from "class-validator";

export class RequestLeadCodeDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
