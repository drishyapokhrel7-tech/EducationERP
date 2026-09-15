import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { LibraryService } from "./library.service";
import { CreateBookCategoryDto } from "./dto/create-book-category.dto";
import { UpdateBookCategoryDto } from "./dto/update-book-category.dto";
import { CreateBookDto } from "./dto/create-book.dto";
import { UpdateBookDto } from "./dto/update-book.dto";
import { IssueBookDto } from "./dto/issue-book.dto";
import { CreateFineDto } from "./dto/create-fine.dto";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { UpdateLibrarySettingsDto } from "./dto/update-library-settings.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { IMAGE_UPLOAD_OPTIONS } from "../../common/upload-limits";

// library:view for reads, library:manage for every write — coarse
// two-action scheme, same precedent as Inventory rather than a full
// per-verb CRUD matrix.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me/library")
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Post("categories")
  @RequirePermissions("library:manage")
  createCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateBookCategoryDto) {
    return this.library.createCategory(user.organizationId, dto);
  }

  @Get("categories")
  @RequirePermissions("library:view")
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.library.listCategories(user.organizationId);
  }

  @Patch("categories/:id")
  @RequirePermissions("library:manage")
  updateCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateBookCategoryDto) {
    return this.library.updateCategory(user.organizationId, id, dto);
  }

  @Delete("categories/:id")
  @RequirePermissions("library:manage")
  deleteCategory(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.deleteCategory(user.organizationId, id);
  }

  @Post("books")
  @RequirePermissions("library:manage")
  createBook(@CurrentUser() user: JwtPayload, @Body() dto: CreateBookDto) {
    return this.library.createBook(user.organizationId, dto);
  }

  @Get("books")
  @RequirePermissions("library:view")
  listBooks(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationQueryDto) {
    return this.library.listBooks(user.organizationId, pagination.page ?? 1, pagination.pageSize ?? 25);
  }

  // Deliberately separate from the paginated listBooks above — see
  // LibraryService.listBooksPicker's comment.
  @Get("books/picker")
  @RequirePermissions("library:view")
  listBooksPicker(@CurrentUser() user: JwtPayload, @Query("query") query?: string) {
    return this.library.listBooksPicker(user.organizationId, query);
  }

  @Patch("books/:id")
  @RequirePermissions("library:manage")
  updateBook(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: UpdateBookDto) {
    return this.library.updateBook(user.organizationId, id, dto);
  }

  @Delete("books/:id")
  @RequirePermissions("library:manage")
  deleteBook(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.deleteBook(user.organizationId, id);
  }

  // Preview-only — prefills the add-book form, never writes a Book
  // itself. Gated on library:manage (same as create) since it only
  // makes sense as part of that flow.
  @Get("books/isbn-lookup/:isbn")
  @RequirePermissions("library:manage")
  isbnLookup(@Param("isbn") isbn: string) {
    return this.library.isbnLookup(isbn);
  }

  @Post("books/ocr-scan")
  @RequirePermissions("library:manage")
  @UseInterceptors(FileInterceptor("image", IMAGE_UPLOAD_OPTIONS))
  ocrScanCover(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException("No file uploaded (expected a multipart field named 'image')");
    }
    return this.library.ocrScanCover(file.buffer);
  }

  @Post("transactions/issue")
  @RequirePermissions("library:manage")
  issueBook(@CurrentUser() user: JwtPayload, @Body() dto: IssueBookDto) {
    return this.library.issueBook(user.organizationId, user.sub, dto);
  }

  @Post("transactions/:id/return")
  @RequirePermissions("library:manage")
  returnBook(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.returnBook(user.organizationId, user.sub, id);
  }

  // Manual, optional-query parsing (not ParseBoolPipe's `optional`
  // option) — this project's own documented workaround, surfaced during
  // librarysystem's own Phase 2 against the same NestJS version family.
  @Get("transactions")
  @RequirePermissions("library:view")
  listTransactions(
    @CurrentUser() user: JwtPayload,
    @Query("bookId") bookId?: string,
    @Query("studentId") studentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("open") open?: string,
  ) {
    return this.library.listTransactions(user.organizationId, {
      bookId,
      studentId,
      employeeId,
      open: open === "true",
    });
  }

  @Post("fines")
  @RequirePermissions("library:manage")
  createFine(@CurrentUser() user: JwtPayload, @Body() dto: CreateFineDto) {
    return this.library.createFine(user.organizationId, dto);
  }

  @Get("fines")
  @RequirePermissions("library:view")
  listFines(
    @CurrentUser() user: JwtPayload,
    @Query("studentId") studentId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: string,
  ) {
    return this.library.listFines(user.organizationId, { studentId, employeeId, status });
  }

  @Post("fines/:id/pay")
  @RequirePermissions("library:manage")
  payFine(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.payFine(user.organizationId, id);
  }

  @Post("fines/:id/waive")
  @RequirePermissions("library:manage")
  waiveFine(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.waiveFine(user.organizationId, id);
  }

  @Post("reservations")
  @RequirePermissions("library:manage")
  createReservation(@CurrentUser() user: JwtPayload, @Body() dto: CreateReservationDto) {
    return this.library.createReservation(user.organizationId, dto);
  }

  @Get("reservations")
  @RequirePermissions("library:view")
  listReservations(@CurrentUser() user: JwtPayload, @Query("bookId") bookId?: string, @Query("status") status?: string) {
    return this.library.listReservations(user.organizationId, { bookId, status });
  }

  @Post("reservations/:id/cancel")
  @RequirePermissions("library:manage")
  cancelReservation(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.library.cancelReservation(user.organizationId, id);
  }

  @Get("settings")
  @RequirePermissions("library:view")
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.library.getSettings(user.organizationId);
  }

  @Patch("settings")
  @RequirePermissions("library:manage")
  updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLibrarySettingsDto) {
    return this.library.updateSettings(user.organizationId, dto);
  }

  @Get("reports/overdue")
  @RequirePermissions("library:view")
  overdueReport(@CurrentUser() user: JwtPayload) {
    return this.library.overdueReport(user.organizationId);
  }

  @Get("reports/most-borrowed")
  @RequirePermissions("library:view")
  mostBorrowedReport(@CurrentUser() user: JwtPayload) {
    return this.library.mostBorrowedReport(user.organizationId);
  }
}
