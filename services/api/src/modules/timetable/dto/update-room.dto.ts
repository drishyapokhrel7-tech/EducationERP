import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsString()
  roomType?: string;
}
