import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CameraEventsService } from "./camera-events.service";
import { CreateCameraDto } from "./dto/create-camera.dto";
import { ReviewFaceMatchDto } from "./dto/review-face-match.dto";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtPayload } from "../../common/auth/jwt-payload";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations/me")
export class CameraEventsController {
  constructor(private readonly cameraEvents: CameraEventsService) {}

  @Post("cameras")
  @RequirePermissions("camera:create")
  createCamera(@CurrentUser() user: JwtPayload, @Body() dto: CreateCameraDto) {
    return this.cameraEvents.createCamera(user.organizationId, dto);
  }

  @Get("cameras")
  @RequirePermissions("camera:view")
  listCameras(@CurrentUser() user: JwtPayload) {
    return this.cameraEvents.listCameras(user.organizationId);
  }

  // The plan's "simulated camera source": this endpoint doesn't know or
  // care whether the image arrived from a real camera adapter (not
  // built yet, slice 6e) or a plain upload — any POSTed image already
  // exercises the full capture→match pipeline.
  @Post("cameras/:cameraId/events")
  @RequirePermissions("camera:create")
  @UseInterceptors(FileInterceptor("image"))
  ingestEvent(
    @CurrentUser() user: JwtPayload,
    @Param("cameraId") cameraId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded (expected a multipart field named 'image')");
    }
    return this.cameraEvents.ingestEvent(user.organizationId, cameraId, file);
  }

  @Get("face-match-events")
  @RequirePermissions("face_match_event:view")
  listFaceMatchEvents(@CurrentUser() user: JwtPayload) {
    return this.cameraEvents.listFaceMatchEvents(user.organizationId);
  }

  @Get("face-match-events/:id/image")
  @RequirePermissions("face_match_event:view")
  @Header("Cache-Control", "no-store")
  async getFaceMatchImage(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const { buffer, mimetype } = await this.cameraEvents.getFaceMatchImage(user.organizationId, id);
    return new StreamableFile(buffer, { type: mimetype });
  }

  @Post("face-match-events/:id/review")
  @RequirePermissions("face_match_event:update")
  reviewFaceMatch(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: ReviewFaceMatchDto) {
    return this.cameraEvents.reviewFaceMatch(user.organizationId, user.sub, id, dto);
  }
}
