import { IsString } from "class-validator";

export class AssignSalaryStructureDto {
  @IsString()
  salaryStructureId!: string;
}
