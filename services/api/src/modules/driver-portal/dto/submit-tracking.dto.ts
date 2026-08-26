import { IsLatitude, IsLongitude, IsString } from "class-validator";

export class SubmitTrackingDto {
  @IsString()
  routeId!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
