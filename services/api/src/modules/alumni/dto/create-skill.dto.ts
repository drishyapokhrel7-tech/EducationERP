import { IsString, MinLength } from "class-validator";

export class CreateSkillDto {
  @IsString()
  @MinLength(1)
  skillName!: string;
}
