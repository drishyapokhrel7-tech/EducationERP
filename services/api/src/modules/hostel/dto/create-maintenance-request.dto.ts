import { IsString, MinLength } from "class-validator";

export class CreateMaintenanceRequestDto {
  @IsString()
  roomId!: string;

  @IsString()
  @MinLength(1)
  description!: string;
}
