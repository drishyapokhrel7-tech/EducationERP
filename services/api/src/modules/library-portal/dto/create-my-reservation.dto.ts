import { IsString } from "class-validator";

export class CreateMyReservationDto {
  @IsString()
  bookId!: string;
}
