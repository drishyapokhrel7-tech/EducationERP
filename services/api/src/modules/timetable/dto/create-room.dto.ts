import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateRoomDto {
  @IsString()
  campusId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsString()
  roomType?: string;
}
