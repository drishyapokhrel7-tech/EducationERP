import { Global, Module } from "@nestjs/common";
import { PermissionResolver } from "./permission-resolver";

// Global so PermissionsGuard — instantiated by Nest per controller
// module wherever @UseGuards(PermissionsGuard) appears — can inject
// PermissionResolver without every feature module importing it.
@Global()
@Module({
  providers: [PermissionResolver],
  exports: [PermissionResolver],
})
export class AuthCommonModule {}
