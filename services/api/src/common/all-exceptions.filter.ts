import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

// A multer validation failure (file too large, wrong MIME type — see
// common/upload-limits.ts) needs no special case here: every upload
// route in this app goes through Nest's own FileInterceptor, whose
// multer/multer.utils.ts#transformException already converts a raw
// MulterError into a clean HttpException (PayloadTooLargeException
// for LIMIT_FILE_SIZE, BadRequestException for everything else)
// before it ever reaches a global filter — confirmed live, a 20MB
// upload comes back 413 "File too large", not a 500. So the
// HttpException passthrough below already covers it; a dedicated
// MulterError branch here would just be dead code no request can
// ever reach with this app's interceptor wiring.
//
// Everything else — every existing NotFoundException/ConflictException/
// BadRequestException already thrown throughout this app — passes
// straight through to Nest's own default handling unchanged; this
// filter's only real job is the generic-500 case below, which Nest
// doesn't otherwise let us log server-side before responding.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionsHandler");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // Genuinely unexpected — log the full error server-side (never in
    // the client response) and return Nest's own generic shape so
    // nothing about this path changes from default behavior besides
    // the multer translation above.
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: "Internal server error" });
  }
}
