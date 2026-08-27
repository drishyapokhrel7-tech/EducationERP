import { Module } from "@nestjs/common";
import { PlatformOrganizationsService } from "./platform-organizations.service";
import { PlatformOrganizationsController } from "./platform-organizations.controller";

// PlatformAuthGuard works here without importing PlatformAuthModule —
// same as every other module's JwtAuthGuard usage never imports
// AuthModule: a Passport strategy registers globally once its
// provider is instantiated anywhere in the app (AppModule pulls in
// PlatformAuthModule, which provides PlatformJwtStrategy), independent
// of Nest's own per-module DI scoping.
@Module({
  providers: [PlatformOrganizationsService],
  controllers: [PlatformOrganizationsController],
})
export class PlatformOrganizationsModule {}
