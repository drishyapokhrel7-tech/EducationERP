import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateRoomDto {
  @IsString()
  buildingId!: string;

  @IsString()
  @MinLength(1)
  roomNumber!: string;

  @IsOptional()
  @IsString()
  roomType?: string;
}
