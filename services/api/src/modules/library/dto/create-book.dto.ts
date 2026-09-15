import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class CreateBookDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsString()
  edition?: string;

  @IsOptional()
  @IsString()
  shelfLocation?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  totalCopies?: number;
}
