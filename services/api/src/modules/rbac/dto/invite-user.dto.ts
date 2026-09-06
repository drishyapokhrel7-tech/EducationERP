import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  roleId!: string;
}
