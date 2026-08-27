import { IsString, MinLength } from "class-validator";

export class CreateBuildingDto {
  @IsString()
  hostelId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
