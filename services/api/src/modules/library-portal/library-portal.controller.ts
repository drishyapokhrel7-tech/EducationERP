import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { LibraryPortalService } from "./library-portal.service";
import { CreateMyReservationDto } from "./dto/create-my-reservation.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// Deliberately JwtAuthGuard only — no PermissionsGuard/@RequirePermissions,
// same shape as student-portal/teacher-portal/guardian-portal: this is
// "is this the right student," not a permission string.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/library-portal")
export class LibraryPortalController {
  constructor(private readonly libraryPortal: LibraryPortalService) {}

  @Get("me")
  getMe(@CurrentUser() user: JwtPayload) {
    return this.libraryPortal.getMe(user.organizationId, user.sub);
  }

  @Get("books")
  searchBooks(@CurrentUser() user: JwtPayload, @Query("query") query?: string) {
    return this.libraryPortal.searchBooks(user.organizationId, query);
  }

  @Get("my-loans")
  listMyLoans(@CurrentUser() user: JwtPayload) {
    return this.libraryPortal.listMyLoans(user.organizationId, user.sub);
  }

  @Get("my-fines")
  listMyFines(@CurrentUser() user: JwtPayload) {
    return this.libraryPortal.listMyFines(user.organizationId, user.sub);
  }

  @Get("my-reservations")
  listMyReservations(@CurrentUser() user: JwtPayload) {
    return this.libraryPortal.listMyReservations(user.organizationId, user.sub);
  }

  @Post("reservations")
  createReservation(@CurrentUser() user: JwtPayload, @Body() dto: CreateMyReservationDto) {
    return this.libraryPortal.createReservation(user.organizationId, user.sub, dto);
  }

  @Post("reservations/:id/cancel")
  cancelReservation(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.libraryPortal.cancelReservation(user.organizationId, user.sub, id);
  }
}
