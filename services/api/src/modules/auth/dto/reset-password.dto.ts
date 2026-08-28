import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  codeId!: string;

  @IsString()
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
