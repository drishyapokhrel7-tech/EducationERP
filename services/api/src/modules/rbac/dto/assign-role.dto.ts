import { IsOptional, IsString } from "class-validator";

export class AssignRoleDto {
  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  campusId?: string;
}
