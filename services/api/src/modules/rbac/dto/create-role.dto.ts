import { ArrayUnique, IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds!: string[];
}
