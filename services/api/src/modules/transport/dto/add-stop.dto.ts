import { IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Min, MinLength } from "class-validator";

export class AddStopDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  arrivalOffsetMinutes?: number;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
