import { IsString, MinLength } from "class-validator";

export class CreateDesignationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
