import { IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

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

  // Raising totalCopies also raises availableCopies by the same delta
  // (see LibraryService.updateBook) — lowering it is rejected if it
  // would drop availableCopies below the count of currently-open
  // transactions, same "don't silently orphan a real loan" instinct as
  // assertNoDependents.
  @IsOptional()
  @IsInt()
  @IsPositive()
  totalCopies?: number;
}
