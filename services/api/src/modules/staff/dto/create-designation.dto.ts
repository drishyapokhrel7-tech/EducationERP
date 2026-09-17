import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateDesignationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  // Optional — see the schema comment on Designation.staffTypeId. When
  // set, the employee form's Designation dropdown only offers this
  // designation once that staff type is selected (plus every
  // still-unassigned designation), instead of the full unfiltered list.
  @IsOptional()
  @IsString()
  staffTypeId?: string;
}
