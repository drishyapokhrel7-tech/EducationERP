import { IsInt, IsOptional, IsPositive, IsString } from "class-validator";

export class CreateExamRoomDto {
  @IsString()
  roomId!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;
}
