import { IsString, MinLength } from "class-validator";

export class CreateIncidentTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
