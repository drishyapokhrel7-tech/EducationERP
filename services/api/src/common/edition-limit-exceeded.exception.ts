import { ForbiddenException } from "@nestjs/common";
import { Edition } from "@prisma/client";

// A distinct exception (not a plain ForbiddenException with a
// message) so the frontend can reliably detect "hit the licensing
// cap" via a structured error code and render the upgrade banner,
// rather than string-matching an error message.
export class EditionLimitExceededException extends ForbiddenException {
  constructor(edition: Edition, limit: number) {
    super({ error: "EDITION_LIMIT_EXCEEDED", edition, limit });
  }
}
