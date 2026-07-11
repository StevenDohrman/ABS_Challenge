import { Prisma } from "@prisma/client";

/** Typed HTTP error for controllers — caught by asyncHandler and mapped to JSON. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function httpStatusForError(err: unknown): number {
  if (err instanceof HttpError) {
    return err.status;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P1001: can't reach server, P1002: server timeout, P1017: connection closed
    if (err.code === "P1001" || err.code === "P1002" || err.code === "P1017") {
      return 503;
    }
    // P2024: pool timeout waiting for connection
    if (err.code === "P2024") {
      return 503;
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return 503;
  }

  return 500;
}

export function publicErrorMessage(err: unknown, status: number): string {
  if (err instanceof HttpError) {
    return err.message;
  }
  if (status === 503) {
    return "Database temporarily unavailable";
  }
  return "Internal server error";
}

/** True for transient Prisma connectivity / pool errors (P1001, P1002, P1017, P2024). */
export function isDbConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      err.code === "P1001" ||
      err.code === "P1002" ||
      err.code === "P1017" ||
      err.code === "P2024"
    );
  }
  return err instanceof Prisma.PrismaClientInitializationError;
}
