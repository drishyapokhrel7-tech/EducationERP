import { IsString } from "class-validator";

export class VerifyEmailDto {
  @IsString()
  codeId!: string;

  @IsString()
  code!: string;
}
