import { IsString, MinLength } from "class-validator";

export class CreateBedDto {
  @IsString()
  roomId!: string;

  @IsString()
  @MinLength(1)
  label!: string;
}
