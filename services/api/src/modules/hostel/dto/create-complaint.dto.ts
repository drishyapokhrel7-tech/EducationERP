import { IsString, MinLength } from "class-validator";

export class CreateComplaintDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsString()
  @MinLength(1)
  description!: string;
}
