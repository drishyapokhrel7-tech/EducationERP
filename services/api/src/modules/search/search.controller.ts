import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

// Deliberately JwtAuthGuard only, no @RequirePermissions — a global
// search bar shouldn't 403 outright for a caller who lacks one
// category's view permission, it should just quietly omit that
// category. SearchService itself does the per-category permission
// check against the caller's own JWT-carried permissions.
@UseGuards(JwtAuthGuard)
@Controller("organizations/me/search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  globalSearch(@CurrentUser() user: JwtPayload, @Query("q") q: string) {
    return this.search.search(user.organizationId, user.permissions, q ?? "");
  }
}
