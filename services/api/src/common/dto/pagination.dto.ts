import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

// Phase 8 performance-optimization slice. Offset-based (skip/take), not
// cursor-based — this is an admin console at single-institution scale
// (hundreds to low-thousands of rows per table), where O(skip) cost is
// negligible and "page 3 of 12" is a simpler, more honest UI than an
// opaque cursor. See docs/PHASE_8_NOTES.md's scale-assumptions note for
// the concrete signal that would justify revisiting this.
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
