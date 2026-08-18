import { IsString, MinLength } from "class-validator";

export class CreateCurriculumDto {
  @IsString()
  programId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
